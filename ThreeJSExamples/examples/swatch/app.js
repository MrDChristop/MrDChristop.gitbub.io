
import * as THREE from '../../build/three.module.js';
import { ARButton } from '../jsm/webxr/ARButton.js';
import { Stats } from '../stats.module.js';
import { OrbitControls } from '../jsm/controls/OrbitControls.js';
import { CanvasUI } from '../CanvasUI.js'
import { GLTFLoader } from '../jsm/loaders/GLTFLoader.js';
import { RGBELoader } from '../jsm/loaders/RGBELoader.js';
import { LoadingBar } from '../LoadingBar.js';
import { Player } from '../Player.js';



// added because new syntax is terrible
THREE.Box3.prototype.center = function () {
    return this.getCenter(new THREE.Vector3);
};

THREE.Box3.prototype.size = function () {
    return this.getSize(new THREE.Vector3);
};

class App{
	constructor(){
        this.canvas = document.querySelector('canvas.webgl')
		//const container = document.createElement( 'div' );
		//document.body.appendChild( container );
        //this.arAspect = this.canvas.clientWidth /  this.canvas.clientHeight;
        this.arCameraObject = null;
        this.sessionEndFlag = false;

        this.clock = new THREE.Clock();
        
        this.loadingBar = new LoadingBar();

		this.assetsPath = '../assets/';
        
		//this.camera = new THREE.PerspectiveCamera( 69, window.innerWidth / window.innerHeight, 0.01, 20 );
		this.camera = new THREE.PerspectiveCamera( 49,  this.canvas.clientWidth /  this.canvas.clientHeight, 0.01, 20 );
        this.camera.position.set( 0, 0, 0.5 );
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(1,0,0);

		const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.1);
        ambient.position.set( 0.5, 1, 0.25 );
		this.scene.add(ambient);
        
        //const light = new THREE.DirectionalLight();
        //light.position.set( 0.2, 1, 1);
        //this.scene.add(light);
        
		this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true } );
		//this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true } );
		//this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setPixelRatio(1);
        //this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		this.renderer.setSize( this.canvas.clientWidth, this.canvas.clientHeight);
		//this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.outputEncoding = THREE.sRGBEncoding;
		//container.appendChild( this.renderer.domElement );
        this.setEnvironment();
        
        this.workingVec3 = new THREE.Vector3();
        this.assetToCamVec3 = new THREE.Vector3();
        this.camWorldQuaternion = new THREE.Quaternion();
        this.camDirVec3 = new THREE.Vector3();
        
        //this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        //this.controls = new OrbitControls( this.camera, this.canvas );
        //this.controls.target.set(0, 0, 0);
        //this.controls.update();

        //this.stats = new Stats();
        //document.body.appendChild( this.stats.dom );

        this.initScene();
        this.setupXR();
		
		window.addEventListener('resize', this.resize.bind(this));
        
        document.getElementById("resetBtn").addEventListener("click", ()=>{
             //this.controls.target.set(0, 0, 0);
             //this.controls.update();
            // const screenshotTarget = document.body;

            //html2canvas(screenshotTarget).then((canvas) => {
            //     const base64image = canvas.toDataURL("image/png");
             //    document.getElementById("photo").src = base64image;
            //    });

        });

        //https://codepen.io/munsocket/pen/dayZJg
        let mc = new Hammer.Manager(this.canvas);
        let pan = new Hammer.Pan();
        let rotate = new Hammer.Rotate();

        mc.add([pan, rotate]);
       // mc.get('pinch').set({ enable: true });
        mc.get('rotate').set({ enable: true });

        this.adjustDeltaX = 0;
        this.adjustDeltaY = 0;
        this.adjustRotation = 0;

        let currentDeltaX = null;
        let currentDeltaY = null;
        let currentRotation = null;

        this.hammerUI = false;

        const self = this;

        mc.on("panstart rotatestart", function(e) {
            if (!self.renderer.xr.isPresenting)
                return;
    
            self.adjustRotation -= e.rotation;
            self.hammerUI = true;
        });

        mc.on("panmove rotatemove", function(e) {
            if (!self.renderer.xr.isPresenting)
                return;

            currentRotation = self.adjustRotation + e.rotation;
            currentDeltaX = self.adjustDeltaX + e.deltaX;
            currentDeltaY = self.adjustDeltaY + e.deltaY;

            if (self.tranformer.visible)
            {
                self.tranformer.position.addVectors(self.tranformerLocalPos, new THREE.Vector3(currentDeltaX/1000, 0 ,currentDeltaY/1000));
                self.tranformer.getWorldPosition(self.workingVec3);
                self.tranformer.rotation.set(0,THREE.MathUtils.degToRad(Math.round(currentRotation)),0);
            }

            //document.getElementById("netwMessages").value = `x:${currentDeltaX} y:${currentDeltaY} rotation:${Math.round(currentRotation)}`;
        });

        mc.on("panend rotateend", function(e) {
            if (!self.renderer.xr.isPresenting)
                return;
        
            self.adjustRotation = currentRotation;
            self.adjustDeltaX = currentDeltaX;
            self.adjustDeltaY = currentDeltaY;
        });
	}
    
    setEnvironment(){
        const loader = new RGBELoader().setDataType( THREE.UnsignedByteType );
        const pmremGenerator = new THREE.PMREMGenerator( this.renderer );
        pmremGenerator.compileEquirectangularShader();
        
        const self = this;
        
        loader.load( '../assets/venice_sunset_1k.hdr', ( texture ) => {
          const envMap = pmremGenerator.fromEquirectangular( texture ).texture;
          pmremGenerator.dispose();

          self.scene.environment = envMap;

        }, undefined, (err)=>{
            console.error( 'An error occurred setting the environment');
        } );
    }
	
    resize(){ 
        if (this.arCameraObject && this.sessionEndFlag) {
            this.camera.aspect = this.arCameraObject.aspect;
            this.camera.fov = this.arCameraObject.fov;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize( this.canvas.clientHeight*this.arCameraObject.aspect, this.canvas.clientHeight);
            this.arCameraObject = null;
            self.sessionEndFlag = true;
            return;
        }

        this.camera.aspect = this.canvas.clientWidth /  this.canvas.clientHeight;
        //this.camera.aspect = window.innerWidth / window.innerHeight;
    	this.camera.updateProjectionMatrix();
        this.renderer.setSize( this.canvas.clientWidth, this.canvas.clientHeight);
        //this.renderer.setSize( window.innerWidth, window.innerHeight ); 
    }
    
    loadShoe(){
	    const loader = new GLTFLoader().setPath(this.assetsPath);
		const self = this;
		
		// Load a GLTF resource
		loader.load(
			// resource URL
			`kzn66_fw7147_fw20.glb`,
			// called when the resource is loaded
			function ( gltf ) {

                self.shoe = gltf.scene;

                self.shoe.traverse(n => { 
                    if ( n.isMesh ) {
                        //used primarily to avoid zfight
                        n.material.side = THREE.FrontSide;
                    }
                });
            
                //position show as in swatch
                self.shoe.rotation.set(Math.PI * -0.5, 0, Math.PI * -0.5);
                self.shoe.children[0].rotation.set(0, 0, 0);

                var bbox = new THREE.Box3().setFromObject(self.shoe);
                var center = bbox.center();
                //var radius = bbox.size();
                var k = 1/100; //show is in cm bring to meters

                //center 
                self.shoe.position.set(k * -center.x, k * -center.y, k * -center.z);
                self.shoe.scale.set(k,k,k);
                //set new custom bbox property
                self.shoe.bbox = new THREE.Box3().setFromObject(self.shoe);
                
                self.rotateToFaceUser = new THREE.Group();
                self.rotateToFaceUser.add(self.shoe)

                self.tranformer = new THREE.Group();
                self.tranformer.name = "transformer";
                self.tranformer.add(self.rotateToFaceUser);             
                self.scene.add( self.tranformer );

                console.log(self.shoe.bbox.size());
             
                				
                self.loadingBar.visible = false;
                self.renderer.setAnimationLoop( self.render.bind(self) );
                //(timestamp, frame) => { self.render(timestamp, frame); } );
			},
			// called while loading is progressing
			function ( xhr ) {

				self.loadingBar.progress = (xhr.loaded / xhr.total);

			},
			// called when loading has errors
			function ( error ) {

				console.log( 'An error happened' );

			}
		);
	}		
    
    initScene(){
        this.reticle = new THREE.Mesh(
            new THREE.RingBufferGeometry( 0.15, 0.2, 32 ).rotateX( - Math.PI / 2 ),
            new THREE.MeshBasicMaterial({transparent:true, opacity:0.25})
        );
        
        this.reticle.matrixAutoUpdate = false;
        this.reticle.visible = false;
        this.scene.add( this.reticle );
        
        this.loadShoe();
    }
    
    setupXR(){
        this.renderer.xr.enabled = true;
        
        function onSessionStart(){
            self.tranformer.visible = false;
            self.scene.background = null;
            self.adjustDeltaX = 0;
            self.adjustDeltaY = 0;
            self.adjustRotation = 0;
            //document.getElementById("netwMessages").value = document.body.innerHTML;
            //document.getElementById("netwMessages").value = self.renderer.domElement.outerHTML;
        }
       
        function onSessionEnd(){
            document.body.style.display="";
            self.tranformer.visible = true;
            self.tranformer.position.set(0,0,0);
            //self.camera.position.set( 0, 0, -0.5 );
            self.camera.position.copy(self.assetToCamVec3);
            self.camera.quaternion.copy(self.camWorldQuaternion);
            //self.controls.target.set(0, 0, 0);
            //self.controls.target.copy(self.camDirVec3);
            //self.controls.object.up.set(0, 1, 0);
            //self.controls.update();
            //self.renderer.domElement.style.display="";
            self.scene.background = new THREE.Color(1,0,0);
            
            self.reticle.visible = false;
            self.sessionEndFlag = true;
        }
        
        this.renderer.xr.addEventListener( 'sessionstart', onSessionStart );
        this.renderer.xr.addEventListener( 'sessionend', onSessionEnd );
        
        document.body.appendChild(ARButton.createButton(this.renderer, { requiredFeatures: [ 'hit-test' ], optionalFeatures: [ 'dom-overlay' ], domOverlay: { root: document.body } }));
        
        const self = this;

        this.hitTestSourceRequested = false;
        this.hitTestSource = null;
        
        function onSelect() {
            if (self.shoe===undefined) return;

            if (self.hammerUI) {
                self.hammerUI = false;
                return;
            }
            
            if (self.reticle.visible){
                self.tranformer.position.setFromMatrixPosition( self.reticle.matrix );
                self.tranformer.translateY(-self.shoe.position.y);
                self.tranformer.visible = true;
                self.tranformerLocalPos = new THREE.Vector3().copy(self.tranformer.position);
                self.tranformer.getWorldPosition(self.workingVec3);

                //position the shoe as its positioned in swatch upon start facing the viewer
                //compute angle between the positive X axis, and the point (x, y) to rotate around y only
                self.rotateToFaceUser.rotation.y = Math.atan2( -( self.camera.position.x - self.workingVec3.x ), -( self.camera.position.z - self.workingVec3.z ) );

                //hammerjs
                self.adjustDeltaX = 0;
                self.adjustDeltaY = 0;
            }
        }

        this.controller = this.renderer.xr.getController( 0 );
        this.controller.addEventListener( 'select', onSelect );
        
        this.scene.add( this.controller );    
    }
    
    requestHitTestSource(){
        const self = this;
        
        const session = this.renderer.xr.getSession();

        session.requestReferenceSpace( 'viewer' ).then( function ( referenceSpace ) {
            
            session.requestHitTestSource( { space: referenceSpace } ).then( function ( source ) {

                self.hitTestSource = source;

            } );

        } );

        session.addEventListener( 'end', function () {

            self.hitTestSourceRequested = false;
            self.hitTestSource = null;
            self.referenceSpace = null;

        } );

        this.hitTestSourceRequested = true;

    }
    
    getHitTestResults( frame ){
        const hitTestResults = frame.getHitTestResults( this.hitTestSource );

        if ( hitTestResults.length ) {
            
            const referenceSpace = this.renderer.xr.getReferenceSpace();
            const hit = hitTestResults[ 0 ];
            const pose = hit.getPose( referenceSpace );

            this.reticle.visible = true;
            this.reticle.matrix.fromArray( pose.transform.matrix );

        } else {

            this.reticle.visible = false;

        }

    }


    createMsg( pos, rot){
        let dist = pos.distanceTo(rot);
        const msg = `camera:${pos.x.toFixed(3)},${pos.y.toFixed(3)},${pos.z.toFixed(3)} asset:${rot.x.toFixed(2)},${rot.y.toFixed(2)},${rot.z.toFixed(2)} distance:${dist}`;
        return msg;
    }

    createMsgCam ( cam){
        document.getElementById("netwMessages").value = `aspect:${cam.aspect} fov:${cam.fov} far/near:${cam.far} ${cam.near} gauge:${cam.filmGauge} zoom:${cam.zoom} ${window.innerWidth} ${window.innerHeight}`;
    }
    

    render( timestamp, frame ) {
        const dt = this.clock.getDelta();

        const self = this;

        //this.stats.update();
        
        if ( frame ) {
            //https://github.com/mrdoob/three.js/issues/13173
            let der = this.renderer.xr.getReferenceSpace();
            let das = frame.getViewerPose(der);
            if (das) {
            let fovi = das.views[0].projectionMatrix[5];
            const fov = Math.atan2(1, fovi) * 2 * 180 / Math.PI;
            //console.log(fov);

             self.arCameraObject = {aspect:window.innerWidth / window.innerHeight, fov:fov}
            }

            if ( this.hitTestSourceRequested === false ) this.requestHitTestSource( )

            if ( this.hitTestSource ) this.getHitTestResults( frame );
            
            self.assetToCamVec3.subVectors(self.camera.position, self.workingVec3);
            self.camera.getWorldDirection(self.camDirVec3);
            self.camera.getWorldQuaternion(self.camWorldQuaternion);

            //document.getElementById("netwMessages").value = self.createMsg(self.camera.position, self.camera.rotation);
            //self.createMsgCam(self.renderer.xr.getCamera(self.camera))
        }
        //else
        //    self.createMsgCam(self.camera)

        this.renderer.render( this.scene, this.camera );
    }
}

export { App };
