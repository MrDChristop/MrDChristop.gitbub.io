
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
		const container = document.createElement( 'div' );
		document.body.appendChild( container );
        
        this.clock = new THREE.Clock();
        
        this.loadingBar = new LoadingBar();

		this.assetsPath = '../assets/';
        
		this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.01, 20 );
		this.camera.position.set( 0, 0, -0.5 );
        
		this.scene = new THREE.Scene();

		const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.1);
        ambient.position.set( 0.5, 1, 0.25 );
		this.scene.add(ambient);
        
        //const light = new THREE.DirectionalLight();
        //light.position.set( 0.2, 1, 1);
        //this.scene.add(light);
			
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.outputEncoding = THREE.sRGBEncoding;
		container.appendChild( this.renderer.domElement );
        this.setEnvironment();
        
        this.workingVec3 = new THREE.Vector3();
        
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        this.stats = new Stats();
        document.body.appendChild( this.stats.dom );

        this.initScene();
        this.setupXR();
		
		window.addEventListener('resize', this.resize.bind(this));
        
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
        this.camera.aspect = window.innerWidth / window.innerHeight;
    	this.camera.updateProjectionMatrix();
    	this.renderer.setSize( window.innerWidth, window.innerHeight );  
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
            
                self.shoe.rotation.set(Math.PI * -0.5, 0, Math.PI * -0.5);
                self.shoe.children[0].rotation.set(0, 0, 0);

                var bbox = new THREE.Box3().setFromObject(self.shoe);
                var center = bbox.center();
                var radius = bbox.size();
                var k = 1/100;

                self.shoe.position.set(k * -center.x, k * -center.y, k * -center.z);
                self.shoe.scale.set(k,k,k);
                self.shoe.bbox = new THREE.Box3().setFromObject(self.shoe);
                
                self.tranformer = new THREE.Group();
                self.tranformer.name = "transformer";
                self.tranformer.add( self.shoe );
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
        }
       
        function onSessionEnd(){
            document.body.style.display="";
            self.tranformer.visible = true;
            self.tranformer.position.set(0,0,0);
            self.camera.position.set( 0, 0, -0.5 );
            self.controls.target.set(0, 0, 0);
            self.controls.object.up.set(0, 1, 0);
            self.controls.update();
            self.scene.background = new THREE.Color("#FF0000");
            self.renderer.domElement.style.display="";
        }
        
        this.renderer.xr.addEventListener( 'sessionstart', onSessionStart );
        this.renderer.xr.addEventListener( 'sessionend', onSessionEnd );
        
        document.body.appendChild(ARButton.createButton(this.renderer, { requiredFeatures: [ 'hit-test' ], optionalFeatures: [ 'dom-overlay' ], domOverlay: { root: document.body } }));
        
        const self = this;

        this.hitTestSourceRequested = false;
        this.hitTestSource = null;
        
        function onSelect() {
            if (self.shoe===undefined) return;
            
            if (self.reticle.visible){
                self.tranformer.position.setFromMatrixPosition( self.reticle.matrix );
                self.tranformer.translateY(-self.shoe.position.y);
                self.tranformer.visible = true;
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

    render( timestamp, frame ) {
        const dt = this.clock.getDelta();

        const self = this;

        this.stats.update();
        
        if ( frame ) {

            if ( this.hitTestSourceRequested === false ) this.requestHitTestSource( )

            if ( this.hitTestSource ) this.getHitTestResults( frame );

        }

        this.renderer.render( this.scene, this.camera );
    }
}

export { App };
