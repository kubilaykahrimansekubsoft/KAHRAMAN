'use strict';
const $=id=>document.getElementById(id);
const V3=THREE.Vector3;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,k)=>a+(b-a)*k,rand=(a,b)=>a+Math.random()*(b-a),randi=(a,b)=>Math.floor(a+Math.random()*(b-a+1)),pick=a=>a[Math.floor(Math.random()*a.length)];
const mt=(a,b,d)=>Math.abs(b-a)<=d?b:a+Math.sign(b-a)*d;
const damp=(r,dt)=>1-Math.exp(-r*dt);
const UP=new V3(0,1,0),D2R=Math.PI/180;
const _v1=new V3(),_v3=new V3();
function turnAngle(a,b,k){const d=((b-a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return a+d*k;}

/* ---------- renderer ---------- */
const app=$('app');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
const IS_TOUCH=matchMedia('(pointer:coarse)').matches,IS_MOBILE=IS_TOUCH&&Math.min(screen.width,screen.height)<1000;
const DPR=Math.min(window.devicePixelRatio||1,IS_MOBILE?1.3:1.75);
const QUAL_LV=[{n:'Patates',pr:0.5,peds:120,crowd:false,shadow:false,post:false},{n:'Düşük',pr:0.7,peds:400,crowd:false,shadow:false,post:false},{n:'Orta',pr:1.0,peds:900,crowd:true,shadow:true,post:false},{n:'Yüksek',pr:DPR,peds:3000,crowd:true,shadow:true,post:true}];let QUAL=IS_MOBILE?1:2,PED_CAP=900,CROWD_ON=true,QCAP=DPR;renderer.setPixelRatio(DPR);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;renderer.outputEncoding=THREE.sRGBEncoding;
const view=renderer.domElement;view.id='view';app.insertBefore(view,app.firstChild);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(65,1,0.1,1500);

function tex(c,linear){const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());t.encoding=linear?THREE.LinearEncoding:THREE.sRGBEncoding;return t;}
function mkc(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;if(draw)draw(c.getContext('2d'),w,h);return c;}
function cv(w,h,draw,linear){return tex(mkc(w,h,draw),linear);}
function normalMapFrom(hc,strength){const w=hc.width,h=hc.height,src=hc.getContext('2d').getImageData(0,0,w,h).data,c=mkc(w,h),g=c.getContext('2d'),out=g.createImageData(w,h);const H=(x,y)=>src[((((y%h)+h)%h)*w+(((x%w)+w)%w))*4]/255;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const nx=-(H(x+1,y)-H(x-1,y))*strength,ny=(H(x,y+1)-H(x,y-1))*strength,l=Math.sqrt(nx*nx+ny*ny+1),i=(y*w+x)*4;out.data[i]=(nx/l*0.5+0.5)*255;out.data[i+1]=(ny/l*0.5+0.5)*255;out.data[i+2]=(1/l*0.5+0.5)*255;out.data[i+3]=255;}
 g.putImageData(out,0,0);return tex(c,true);}
function shade(hex,k){const n=parseInt(hex.slice(1),16);return 'rgb('+clamp(Math.round((n>>16&255)*k),0,255)+','+clamp(Math.round((n>>8&255)*k),0,255)+','+clamp(Math.round((n&255)*k),0,255)+')';}
function noise(g,w,h,base,v){g.fillStyle=base;g.fillRect(0,0,w,h);for(let i=0;i<w*h/5;i++){g.fillStyle=(Math.random()<.5?'rgba(255,255,255,':'rgba(0,0,0,')+(Math.random()*v)+')';g.fillRect(Math.random()*w,Math.random()*h,1.5,1.5);}}
const lin=c=>new THREE.Color(c).convertSRGBToLinear();
const SUN_DIR=new V3(0.52,0.6,0.6).normalize();
const SKY_VS='varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}';
const SKY_FS='uniform vec3 top;uniform vec3 hor;uniform vec3 gnd;uniform vec3 sunDir;uniform float night;uniform float space;varying vec3 vW;void main(){vec3 d=normalize(vW-cameraPosition);float h=d.y;vec3 c=mix(hor,top,pow(clamp(h,0.0,1.0),0.45));c=mix(c,gnd,1.0-smoothstep(-0.15,0.0,h));c=mix(c,vec3(0.0),space*0.985);float sv=smoothstep(-0.06,0.04,sunDir.y);float s=max(dot(d,sunDir),0.0);c+=vec3(1.0,0.9,0.75)*(pow(s,1200.0)*4.0+pow(s,60.0)*0.25+pow(s,6.0)*0.12)*sv;float m=max(dot(d,-sunDir),0.0);c+=vec3(0.85,0.9,1.0)*(pow(m,2600.0)*3.0+pow(m,90.0)*0.06)*night;vec3 q=floor(d*420.0);float st=fract(sin(dot(q,vec3(12.9898,78.233,37.719)))*43758.5453);c+=vec3(0.9,0.93,1.0)*step(0.9982,st)*max(night,space)*smoothstep(-0.25,0.2,h+space*0.3)*(0.5+0.5*fract(st*91.7));c=pow(clamp(c,0.0,4.0),vec3(2.2));gl_FragColor=linearToOutputTexel(vec4(c,1.0));}';
function makeSky(r){return new THREE.Mesh(new THREE.SphereGeometry(r,32,16),new THREE.ShaderMaterial({uniforms:{top:{value:new THREE.Color(0x2c63b0)},hor:{value:new THREE.Color(0xcfdde9)},gnd:{value:new THREE.Color(0x6a6e74)},sunDir:{value:SUN_DIR},night:{value:0},space:{value:0}},vertexShader:SKY_VS,fragmentShader:SKY_FS,side:THREE.BackSide,depthWrite:false,fog:false}));}
const sky=makeSky(1300);sky.frustumCulled=false;sky.renderOrder=-1;scene.add(sky);
const envScene=new THREE.Scene(),envSky=makeSky(40);envScene.add(envSky);const PMG=new THREE.PMREMGenerator(renderer);let envRT=PMG.fromScene(envScene,0.02);scene.environment=envRT.texture;
function regenEnv(){const old=envRT;envRT=PMG.fromScene(envScene,0.02);scene.environment=envRT.texture;old.dispose();}
const TOD={t:0.66,cycle:false},NIGHT_U={value:0};
scene.fog=new THREE.Fog(lin(0xcfdde9),220,1050);
THREE.ShaderChunk.fog_pars_vertex='#ifdef USE_FOG\nvarying float fogDepth;varying vec3 vFogWorld;\n#endif';
THREE.ShaderChunk.fog_vertex='#ifdef USE_FOG\nfogDepth=-mvPosition.z;{mat3 fR=mat3(viewMatrix);vec3 fv=mvPosition.xyz-viewMatrix[3].xyz;vFogWorld=vec3(dot(fR[0],fv),dot(fR[1],fv),dot(fR[2],fv));}\n#endif';
THREE.ShaderChunk.fog_pars_fragment='#ifdef USE_FOG\nuniform vec3 fogColor;varying float fogDepth;varying vec3 vFogWorld;\n#ifdef FOG_EXP2\nuniform float fogDensity;\n#else\nuniform float fogNear;uniform float fogFar;\n#endif\n#endif';
THREE.ShaderChunk.fog_fragment='#ifdef USE_FOG\n{vec3 fr=vFogWorld-cameraPosition;float fd=length(fr);float fdy=fr.y/max(fd,1e-3);const float fb=0.0042;float fa=3.3/fogFar;float k=fdy*fb*fd;float ft=abs(k)>1e-4?(1.0-exp(-k))/(fdy*fb):fd;float fogFactor=1.0-exp(-fa*exp(-max(cameraPosition.y,0.0)*fb)*ft);fogFactor*=smoothstep(fogNear*0.25,fogNear,fd);gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp(fogFactor,0.0,1.0));}\n#endif';
const HEMI=new THREE.HemisphereLight(lin(0xc4d8f2),lin(0x8a7a66),1.05),AMB=new THREE.AmbientLight(lin(0xdfe7f0),0.18);scene.add(HEMI,AMB);
const sun=new THREE.DirectionalLight(lin(0xfff0da),3.4);sun.castShadow=true;sun.shadow.mapSize.set(IS_MOBILE?1024:2048,IS_MOBILE?1024:2048);
Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:520});sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.03;scene.add(sun,sun.target);
const SUN_OFF=SUN_DIR.clone().multiplyScalar(240);
const flash=new THREE.PointLight(0xffa860,0,80,2);scene.add(flash);
const M=(c,r=0.85,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:lin(c),roughness:r,metalness:0},o));

/* v70 ---------- audio: procedural sound design (mixer, reverb, spatial sfx, ambience, adaptive music) ---------- */
let AC=null,master,sfxBus,musBus,ambBus,revSend,noiseBuf,brownBuf,shaper,laserG,windG,windF,windLowG,whistle,whistleG,trafficG,crowdG,sizzleG;
const VOL={master:0.8,music:0.45,sfx:0.9};
function mkNoise(brown){const b=AC.createBuffer(1,AC.sampleRate*3,AC.sampleRate),d=b.getChannelData(0);let last=0;for(let i=0;i<d.length;i++){const w=Math.random()*2-1;if(brown){last=(last+0.02*w)/1.02;d[i]=last*3.5;}else d[i]=w;}return b;}
function initAudio(){if(AC)return;try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){AC=null;return;}
 const comp=AC.createDynamicsCompressor();comp.threshold.value=-14;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=0.004;comp.release.value=0.2;comp.connect(AC.destination);
 master=AC.createGain();master.gain.value=VOL.master;master.connect(comp);
 sfxBus=AC.createGain();sfxBus.gain.value=VOL.sfx;sfxBus.connect(master);musBus=AC.createGain();musBus.gain.value=VOL.music;musBus.connect(master);ambBus=AC.createGain();ambBus.gain.value=0.8;ambBus.connect(sfxBus);
 const ir=AC.createBuffer(2,AC.sampleRate*2.6,AC.sampleRate);for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3.2);}
 const conv=AC.createConvolver();conv.buffer=ir;revSend=AC.createGain();revSend.gain.value=0.9;revSend.connect(conv);conv.connect(sfxBus);
 noiseBuf=mkNoise(false);brownBuf=mkNoise(true);
 shaper=AC.createWaveShaper();{const n=2048,c=new Float32Array(n);for(let i=0;i<n;i++){const x=i/n*2-1;c[i]=Math.tanh(x*3);}shaper.curve=c;}
 const loop=(buf,filt,f,q,gainNode,dest)=>{const s=AC.createBufferSource();s.buffer=buf;s.loop=true;const fl=AC.createBiquadFilter();fl.type=filt;fl.frequency.value=f;fl.Q.value=q;s.connect(fl);fl.connect(gainNode);gainNode.connect(dest);s.start(0,Math.random()*2);return fl;};
 windG=AC.createGain();windG.gain.value=0;windF=loop(noiseBuf,'bandpass',500,0.6,windG,sfxBus);
 windLowG=AC.createGain();windLowG.gain.value=0;loop(brownBuf,'lowpass',180,0.7,windLowG,sfxBus);
 whistle=AC.createOscillator();whistle.type='sine';whistle.frequency.value=900;whistleG=AC.createGain();whistleG.gain.value=0;whistle.connect(whistleG);whistleG.connect(sfxBus);whistle.start();
 trafficG=AC.createGain();trafficG.gain.value=0;loop(brownBuf,'lowpass',420,0.5,trafficG,ambBus);
 crowdG=AC.createGain();crowdG.gain.value=0;loop(noiseBuf,'bandpass',650,0.9,crowdG,ambBus);
 laserG=AC.createGain();laserG.gain.value=0;{const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1500;lp.Q.value=4;const trem=AC.createGain();trem.gain.value=0.75;const lfo=AC.createOscillator();lfo.frequency.value=19;const lfoG=AC.createGain();lfoG.gain.value=0.25;lfo.connect(lfoG);lfoG.connect(trem.gain);lfo.start();
  for(const [t,f] of[['sawtooth',84],['sawtooth',86.5],['square',170],['sawtooth',253]]){const o=AC.createOscillator();o.type=t;o.frequency.value=f;const g=AC.createGain();g.gain.value=t==='square'?0.35:0.5;o.connect(g);g.connect(lp);o.start();}
  lp.connect(trem);trem.connect(laserG);laserG.connect(sfxBus);
  sizzleG=AC.createGain();sizzleG.gain.value=0;loop(noiseBuf,'bandpass',3200,1.2,sizzleG,laserG);}
 musicInit();}
function applyVolumes(){if(!AC)return;master.gain.setTargetAtTime(VOL.master,AC.currentTime,0.05);musBus.gain.setTargetAtTime(VOL.music,AC.currentTime,0.05);sfxBus.gain.setTargetAtTime(VOL.sfx,AC.currentTime,0.05);}
/* voice chain: source -> gain -> pan -> lowpass -> sfx bus (+ reverb send) */
function chain(vol,pan,cut,wet){const g=AC.createGain();g.gain.value=1;const p=AC.createStereoPanner?AC.createStereoPanner():null;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=cut||20000;
 if(p){p.pan.value=clamp(pan||0,-1,1);g.connect(p);p.connect(f);}else g.connect(f);f.connect(sfxBus);const w=AC.createGain();w.gain.value=wet==null?0.15:wet;f.connect(w);w.connect(revSend);return g;}
function env(g,t0,a,peak,dec){g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak),t0+a);g.gain.exponentialRampToValueAtTime(0.0001,t0+a+dec);}
function tone(type,f0,f1,dur,vol,dest,t,att){const t0=(t||AC.currentTime),o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f0,t0);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t0+dur);env(g,t0,att||0.004,vol,dur);o.connect(g);g.connect(dest);o.start(t0);o.stop(t0+dur+0.1);return o;}
function nz(type,f0,f1,q,dur,vol,dest,t,att,brown){const t0=(t||AC.currentTime),s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();s.buffer=brown?brownBuf:noiseBuf;f.type=type;f.Q.value=q||0.7;f.frequency.setValueAtTime(f0,t0);f.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t0+dur);env(g,t0,att||0.003,vol,dur);s.connect(f);f.connect(g);g.connect(dest);s.start(t0,Math.random()*2.5);s.stop(t0+dur+0.1);}
function fm(cf,ratio,idx0,dur,vol,dest,t,cf1){const t0=(t||AC.currentTime),c=AC.createOscillator(),m=AC.createOscillator(),mg=AC.createGain(),g=AC.createGain();c.frequency.setValueAtTime(cf,t0);if(cf1)c.frequency.exponentialRampToValueAtTime(cf1,t0+dur);m.frequency.setValueAtTime(cf*ratio,t0);if(cf1)m.frequency.exponentialRampToValueAtTime(cf1*ratio,t0+dur);mg.gain.setValueAtTime(idx0,t0);mg.gain.exponentialRampToValueAtTime(1,t0+dur);m.connect(mg);mg.connect(c.frequency);env(g,t0,0.003,vol,dur);c.connect(g);g.connect(dest);c.start(t0);m.start(t0);c.stop(t0+dur+0.1);m.stop(t0+dur+0.1);}
function crackles(n,span,vol,dest,t){const t0=t||AC.currentTime;for(let i=0;i<n;i++)nz('bandpass',rand(800,3500),rand(300,900),1.5,rand(0.02,0.07),vol*rand(0.3,1),dest,t0+Math.random()*span);}
function sfx(name,vol,pan,cut,wet){if(!AC||vol===0)return;vol=vol==null?1:vol;if(vol<=0.02)return;const t=AC.currentTime;const d=chain(1,pan,cut,wet);
 switch(name){
  case'shoot':fm(900,2,420,0.2,0.32*vol,d,t,240);nz('highpass',4200,2400,0.7,0.05,0.18*vol,d,t);tone('sine',140,60,0.14,0.28*vol,d,t);break;
  case'zap':nz('highpass',2600,1400,0.7,0.09,0.55*vol,d,t);nz('lowpass',1100,180,0.7,0.45,0.5*vol,d,t);tone('sine',95,38,0.4,0.55*vol,d,t);fm(1800,3.1,600,0.25,0.12*vol,d,t,700);break;
  case'small':nz('highpass',2400,1200,0.7,0.06,0.4*vol,d,t);nz('lowpass',900,150,0.7,0.35,0.4*vol,d,t);break;
  case'boom':nz('highpass',3000,1500,0.7,0.08,0.7*vol,d,t);nz('lowpass',1400,70,0.6,1.5,0.95*vol,d,t,0.006,true);tone('sine',58,26,1.3,0.75*vol,d,t);crackles(8,0.9,0.18*vol,d,t+0.08);break;
  case'collapse':nz('lowpass',380,60,0.8,4.2,1.0*vol,d,t,0.25,true);tone('sine',44,24,3.5,0.55*vol,d,t,0.2);crackles(34,3.6,0.22*vol,d,t);for(let i=0;i<6;i++)nz('lowpass',700,90,0.7,0.5,0.35*vol,d,t+0.3+Math.random()*3);break;
  case'punch':{const g2=AC.createGain();g2.gain.value=1;shaper.connect||0;const s2=AC.createWaveShaper();s2.curve=shaper.curve;g2.connect(s2);s2.connect(d);tone('sine',170,42,0.24,0.9*vol,g2,t);nz('bandpass',2600,900,1.2,0.07,0.55*vol,d,t);nz('lowpass',700,120,0.7,0.25,0.5*vol,d,t);break;}
  case'sonic':nz('highpass',1200,600,0.5,0.035,1.0*vol,d,t);nz('highpass',1200,600,0.5,0.035,0.85*vol,d,t+0.075);nz('lowpass',600,50,0.7,1.6,0.8*vol,d,t,0.01,true);tone('sine',62,24,1.4,0.6*vol,d,t);break;
  case'shock':tone('sine',78,24,1.3,0.95*vol,d,t);nz('bandpass',180,2400,1.4,0.55,0.45*vol,d,t,0.08);nz('lowpass',900,60,0.7,1.2,0.6*vol,d,t,0.01,true);crackles(10,0.7,0.2*vol,d,t+0.05);break;
  case'jump':nz('bandpass',700,1900,1.1,0.22,0.16*vol,d,t,0.02);break;
  case'land':tone('sine',115,38,0.32,0.75*vol,d,t);nz('lowpass',600,90,0.7,0.3,0.55*vol,d,t,0.004,true);crackles(4,0.25,0.12*vol,d,t);break;
  case'step':{const v=vol*rand(0.8,1.1);nz('bandpass',rand(140,220),90,1.0,0.08,0.45*v,d,t);tone('sine',rand(70,85),40,0.09,0.35*v,d,t);nz('highpass',3500,2500,0.7,0.025,0.08*v,d,t);break;}
  case'hurt':tone('sine',230,110,0.18,0.3*vol,d,t);nz('lowpass',900,200,0.7,0.15,0.3*vol,d,t);break;
  case'ring':fm(1320,3.5,500,1.2,0.22*vol,d,t);fm(1980,3.5,300,0.9,0.12*vol,d,t+0.05);break;
  case'level':[523.25,659.25,783.99,1046.5,1318.5].forEach((f,i)=>fm(f,3.5,400,1.4,0.16*vol,d,t+i*0.09));nz('highpass',6000,9000,0.7,0.8,0.05*vol,d,t+0.1,0.2);break;
  case'alert':for(let i=0;i<2;i++){tone('square',660,660,0.14,0.05*vol,d,t+i*0.32);tone('square',880,880,0.16,0.05*vol,d,t+i*0.32+0.16);}break;
  case'enemyShot':fm(620,1.5,300,0.16,0.14*vol,d,t,170);nz('highpass',3000,1500,0.7,0.04,0.08*vol,d,t);break;
  case'charge':nz('bandpass',300,2600,3,0.16,0.18*vol,d,t,0.08);tone('sawtooth',160,820,0.16,0.05*vol,d,t,0.06);tone('sine',420,1700,0.18,0.08*vol,d,t,0.08);break;
  case'whoosh':nz('bandpass',420,2600,1.3,0.24,0.32*vol,d,t,0.06);break;
  case'clang':fm(430,2.76,700,0.45,0.2*vol,d,t);nz('highpass',4000,2500,0.7,0.04,0.12*vol,d,t);break;
  case'shatter':for(let i=0;i<14;i++)nz('highpass',rand(5000,9000),4000,1,rand(0.03,0.09),0.12*vol,d,t+Math.random()*0.25);nz('highpass',7000,3000,0.7,0.35,0.15*vol,d,t);break;
  case'gun':nz('highpass',2600,1100,0.7,0.045,0.5*vol,d,t);tone('sine',160,55,0.07,0.32*vol,d,t);break;
  case'cannon':nz('highpass',1800,700,0.7,0.08,0.8*vol,d,t);nz('lowpass',900,60,0.6,1.1,0.9*vol,d,t,0.004,true);tone('sine',70,26,0.9,0.7*vol,d,t);break;
  case'jet':nz('bandpass',260,1900,0.9,2.4,0.55*vol,d,t,0.7);nz('lowpass',420,110,0.7,2.6,0.5*vol,d,t,0.6,true);break;
  case'click':tone('sine',1400,900,0.04,0.08*vol,d,t);break;
  case'chirp':for(let i=0;i<randi(2,4);i++)tone('sine',rand(2800,3600),rand(3800,4800),0.07,0.05*vol,d,t+i*0.11);break;
  case'cricket':for(let i=0;i<4;i++)tone('sine',4600,4700,0.03,0.025*vol,d,t+i*0.05);break;
  case'siren':for(let i=0;i<3;i++){tone('triangle',720,960,0.5,0.05*vol,d,t+i);tone('triangle',960,720,0.5,0.05*vol,d,t+i+0.5);}break;}}
function sfxAt(name,pos,range,vol){if(!AC)return;range=range||260;const dx=pos.x-camera.position.x,dy=pos.y-camera.position.y,dz=pos.z-camera.position.z,dd=Math.sqrt(dx*dx+dy*dy+dz*dz),k=clamp(1-dd/range,0,1);if(k<=0.02)return;
 const rx=-Math.cos(yaw),rz=Math.sin(yaw),pan=dd>0.5?clamp((dx*rx+dz*rz)/dd,-1,1)*0.85:0;sfx(name,(vol==null?1:vol)*Math.pow(k,1.25),pan,lerp(1400,20000,Math.pow(k,1.5)),lerp(0.55,0.12,k));}
/* adaptive music: Am F C G, pads always, arpeggio in events, drums in combat */
let mus={next:0,step:0,inten:0.15,on:true};const CH=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]];const mf=n=>440*Math.pow(2,(n-69)/12);
function musicInit(){mus.next=AC.currentTime+0.3;}
function pad(notes,t,dur){for(const n of notes)for(const det of[-6,5]){const o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();o.type='sawtooth';o.frequency.value=mf(n);o.detune.value=det;f.type='lowpass';f.frequency.value=700+mus.inten*900;g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.022,t+1.4);g.gain.setValueAtTime(0.022,t+dur-1.2);g.gain.linearRampToValueAtTime(0.0001,t+dur+0.8);o.connect(f);f.connect(g);g.connect(musBus);o.start(t);o.stop(t+dur+1);}}
function musicTick(){if(!AC||!mus.on)return;const beat=60/84;while(mus.next<AC.currentTime+0.25){const t=mus.next,st=mus.step,bar=Math.floor(st/8),ch=CH[bar%4],inBeat=st%8;
 if(inBeat===0){pad(ch,t,beat*8);const b=AC.createOscillator(),g=AC.createGain();b.type='sine';b.frequency.value=mf(ch[0]-24);env(g,t,0.02,0.12,beat*3.5);b.connect(g);g.connect(musBus);b.start(t);b.stop(t+beat*4);}
 if(inBeat===4){const b=AC.createOscillator(),g=AC.createGain();b.type='sine';b.frequency.value=mf(ch[0]-24);env(g,t,0.02,0.09,beat*3);b.connect(g);g.connect(musBus);b.start(t);b.stop(t+beat*4);}
 if(mus.inten>0.35){for(let h=0;h<2;h++){const n=ch[(st*2+h)%3]+12+(h?12:0);const o=AC.createOscillator(),g=AC.createGain();o.type='triangle';o.frequency.value=mf(n);env(g,t+h*beat/2,0.004,0.04*mus.inten,beat*0.45);o.connect(g);g.connect(musBus);o.start(t+h*beat/2);o.stop(t+h*beat/2+beat*0.6);}}
 if(mus.inten>0.62){if(inBeat%2===0){tone('sine',120,40,0.22,0.22*mus.inten,musBus,t);}if(inBeat%2===1){nz('bandpass',1800,900,0.8,0.16,0.09*mus.inten,musBus,t);}for(let h=0;h<2;h++)nz('highpass',8000,7000,0.7,0.03,0.025*mus.inten,musBus,t+h*beat/2);}
 mus.step++;mus.next+=beat;}}
let ambT=1,sirenT=20,stepPhase=0,clangT=0;
function audioUpdate(dt){if(!AC)return;const now=AC.currentTime,playing=state==='play',sp=playing?pl.vel.length():0,alt=Math.max(0,camera.position.y),fly=playing&&pl.flying;
 const w=clamp((sp-8)/180,0,1);windG.gain.setTargetAtTime(w*0.45+(fly?0.04:0),now,0.12);windF.frequency.setTargetAtTime(350+Math.min(sp,220)*9,now,0.15);windLowG.gain.setTargetAtTime(clamp((sp-20)/150,0,1)*0.5,now,0.15);
 whistleG.gain.setTargetAtTime(clamp((sp-90)/120,0,1)*0.025,now,0.2);whistle.frequency.setTargetAtTime(700+Math.min(sp,200)*5,now,0.2);
 const ground=clamp(1-alt/120,0,1);trafficG.gain.setTargetAtTime(playing||state==='menu'?0.22*ground:0.05,now,0.5);
 if(dt>0){ambT-=dt;if(ambT<=0){ambT=0.5;let n=0;for(const p of peds){const dx=p.x-camera.position.x,dz=p.z-camera.position.z;if(dx*dx+dz*dz<30*30)n++;}crowdG.gain.setTargetAtTime(clamp(n/14,0,1)*0.09*ground,now,0.6);
  const night=NIGHT_U.value;if(ground>0.3&&Math.random()<0.18)sfx(night>0.5?'cricket':'chirp',ground*(night>0.5?0.8:1),rand(-0.8,0.8),9000,0.25);
  let foes=0;for(const e of enemies)if(!e.dead&&e.pos.distanceTo(pl.pos)<70)foes++;const target=state!=='play'?0.12:foes>0?0.85:ev?0.5:0.18;mus.inten+=(target-mus.inten)*0.15;}
  sirenT-=dt;if(sirenT<=0){sirenT=rand(25,45);if(ev&&ev.type!=='race'&&playing)sfx('siren',0.6*ground,rand(-0.7,0.7),3000,0.5);}}
 if(playing&&pl.grounded&&!pl.dead){const hs=Math.hypot(pl.vel.x,pl.vel.z);const ph=Math.floor(HA.ph/Math.PI);if(ph!==stepPhase){stepPhase=ph;if(hs>0.6&&SIZE>5){sfx('land',1);sfx('step',1,0,2500,0.3);addShake(Math.min(0.55,0.08+SIZE*0.006));dustBurst(pl.pos,10,SIZE*0.4,1,SIZE*0.12,SIZE*0.3,1.2);panicAt(pl.pos);}else if(hs>0.6)sfx('step',(civOn?0.45:0.8)*clamp(hs/9,0.4,1.2),0,civOn?9000:6000,0.08);}}
 musicTick();}
/* ---------- textures & materials ---------- */
const asphaltT=cv(512,512,(g,w,h)=>{noise(g,w,h,'#56595d',0.12);for(let i=0;i<16;i++){g.fillStyle='rgba(0,0,0,'+rand(0.04,0.12).toFixed(2)+')';g.beginPath();g.ellipse(rand(0,w),rand(0,h),rand(20,80),rand(10,40),rand(0,3),0,6.3);g.fill();}for(let i=0;i<6;i++){g.fillStyle='rgba(255,255,255,'+rand(0.02,0.05).toFixed(2)+')';g.fillRect(rand(0,w),rand(0,h),rand(30,90),rand(20,60));}g.strokeStyle='rgba(15,15,15,.55)';g.lineWidth=1;for(let i=0;i<12;i++){let x=rand(0,w),y=rand(0,h);g.beginPath();g.moveTo(x,y);for(let k=0;k<9;k++){x+=rand(-14,14);y+=rand(-14,14);g.lineTo(x,y);}g.stroke();}});
const grassT=cv(256,256,(g,w,h)=>noise(g,w,h,'#5d7a45',0.16));grassT.repeat.set(600,600);
const walkT=cv(256,256,(g,w,h)=>{noise(g,w,h,'#aaa9a3',0.09);g.strokeStyle='#86857f';g.lineWidth=2;for(let i=0;i<=4;i++){g.beginPath();g.moveTo(i*64,0);g.lineTo(i*64,h);g.stroke();g.beginPath();g.moveTo(0,i*64);g.lineTo(w,i*64);g.stroke();}});walkT.repeat.set(11,11);
const parkT=cv(256,256,(g,w,h)=>noise(g,w,h,'#5f8a47',0.18));parkT.repeat.set(6,6);
const rubbleT=cv(128,128,(g,w,h)=>{noise(g,w,h,'#77726a',0.3);for(let i=0;i<70;i++){g.fillStyle=pick(['#3a3834','#9a958a','#5f5a52','#b8b2a6']);g.fillRect(rand(0,w),rand(0,h),rand(4,18),rand(3,10));}});
/* realism helpers: ground-contact occlusion shader, rounded shapes, organic foliage */
const AO_VERT='#ifdef USE_INSTANCING\nvWY=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).y;\n#else\nvWY=(modelMatrix*vec4(transformed,1.0)).y;\n#endif\n';
function aoPatch(sh){sh.vertexShader=sh.vertexShader.replace('void main() {','varying float vWY;\nvarying vec2 vObj;\nvoid main() {').replace('#include <begin_vertex>','#include <begin_vertex>\n'+AO_VERT+OBJ_VERT);
 sh.uniforms.uNight=NIGHT_U;sh.fragmentShader=sh.fragmentShader.replace('void main() {','uniform float uNight;\nvarying float vWY;\nvarying vec2 vObj;\nfloat hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nvoid main() {').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nfloat winLit=0.0;\n'+WIN_FRAG).replace('#include <tonemapping_fragment>','gl_FragColor.rgb*=mix(0.52,1.0,smoothstep(0.0,4.5,vWY))*mix(0.8,1.0,smoothstep(0.0,22.0,vWY));gl_FragColor.rgb+=vec3(1.0,0.76,0.48)*winLit*uNight*1.4;\n#include <tonemapping_fragment>');}
const OBJ_VERT='#ifdef USE_INSTANCING\nvObj=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xz;\n#else\nvObj=(modelMatrix*vec4(0.0,0.0,0.0,1.0)).xz;\n#endif\n';
const WIN_FRAG='#ifdef USE_UV\n{float nf=1.0-smoothstep(60.0,240.0,length(vViewPosition));vec2 cell=floor(vUv);float hv=hh(cell+vObj*0.1371);float hv2=hh(cell.yx*1.73+vObj*0.0713);\nif(metalnessFactor>0.12){diffuseColor.rgb*=mix(1.0,mix(0.6,1.4,hv),nf);winLit=mix(0.32,step(0.42,hv2)*step(hv,0.93)*(0.6+0.4*hv),nf);if(hv2>0.86){diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.8,0.72,0.6),0.6*nf);roughnessFactor=mix(roughnessFactor,0.65,nf);}else if(hv2<0.12){diffuseColor.rgb*=mix(1.0,0.45,nf);}}\nelse{float st=hh(vec2(floor(vUv.x*7.0),floor(vObj.x*0.3)));diffuseColor.rgb*=mix(1.0,0.88+0.14*st*(0.6+0.4*fract(vUv.y*0.37)),nf);}}\n#endif\n';
function withAO(m,key){m.onBeforeCompile=aoPatch;m.customProgramCacheKey=()=>key||'ao';return m;}
function roundedBox(w,h,d,r,seg){seg=seg||3;r=Math.min(r,w/2-0.001,h/2-0.001,d/2-0.001);const iw=w-2*r,ih=h-2*r,rc=Math.min(r*0.6,iw/2-0.0005,ih/2-0.0005),s=new THREE.Shape(),x0=-iw/2,y0=-ih/2;
 s.moveTo(x0+rc,y0);s.lineTo(x0+iw-rc,y0);s.absarc(x0+iw-rc,y0+rc,rc,-Math.PI/2,0,false);s.lineTo(x0+iw,y0+ih-rc);s.absarc(x0+iw-rc,y0+ih-rc,rc,0,Math.PI/2,false);s.lineTo(x0+rc,y0+ih);s.absarc(x0+rc,y0+ih-rc,rc,Math.PI/2,Math.PI,false);s.lineTo(x0,y0+rc);s.absarc(x0+rc,y0+rc,rc,Math.PI,1.5*Math.PI,false);
 const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(0.001,d-2*r),bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:seg,curveSegments:seg*2});g.translate(0,0,-(d-2*r)/2);g.computeVertexNormals();return g;}
const _rbCache={};function rbox(w,h,d,r){const k=[w,h,d,r].map(v=>v.toFixed(3)).join(',');return _rbCache[k]||(_rbCache[k]=roundedBox(w,h,d,r));}
function mergeGeos(list){const pos=[],nor=[],uv=[],idx=[];let off=0;for(const g0 of list){const g=g0.index?g0:g0;const a=g.attributes;for(let i=0;i<a.position.count;i++){pos.push(a.position.getX(i),a.position.getY(i),a.position.getZ(i));nor.push(a.normal.getX(i),a.normal.getY(i),a.normal.getZ(i));uv.push(a.uv?a.uv.getX(i):0,a.uv?a.uv.getY(i):0);}
 if(g.index)for(let i=0;i<g.index.count;i++)idx.push(g.index.getX(i)+off);else for(let i=0;i<a.position.count;i++)idx.push(i+off);off+=a.position.count;}
 const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));bg.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));bg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));bg.setIndex(idx);return bg;}
function lumpy(r,amp){const g=new THREE.SphereGeometry(r,18,14),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=Math.sin(x*3.1+y*1.7)*Math.cos(z*2.3-y*1.1)+0.5*Math.sin(x*5.3-z*4.1+y*2.2),k=1+n*amp;p.setXYZ(i,x*k,y*k*0.92,z*k);}g.computeVertexNormals();return g;}
const leafH=mkc(256,256,g=>{g.fillStyle='#707070';g.fillRect(0,0,256,256);for(let i=0;i<900;i++){const v=Math.round(rand(110,255));g.fillStyle='rgb('+v+','+v+','+v+')';g.save();g.translate(rand(0,256),rand(0,256));g.rotate(rand(0,6.3));g.beginPath();g.ellipse(0,0,rand(3,7),rand(1.5,3),0,0,6.3);g.fill();g.restore();}});
const leafCol=mkc(256,256,g=>{g.drawImage(leafH,0,0);const d=g.getImageData(0,0,256,256);for(let i=0;i<d.data.length;i+=4){const v=d.data[i]/255;d.data[i]=Math.round(150+v*105);d.data[i+1]=Math.round(165+v*90);d.data[i+2]=Math.round(140+v*100);}g.putImageData(d,0,0);});
const leafMat=new THREE.MeshStandardMaterial({map:tex(leafCol),normalMap:normalMapFrom(leafH,4),roughness:0.82,metalness:0});leafMat.map.repeat.set(2,2);leafMat.normalMap.repeat.set(2,2);
const canopyGeo=lumpy(1.7,0.16),canopyGeoO=lumpy(1.95,0.14);
const STY=[{k:'glass',wall:'#7f8f9c',glass:'#3a6388'},{k:'glass',wall:'#8d9893',glass:'#2f625c'},{k:'glass',wall:'#9a8c78',glass:'#54432f'},{k:'office',wall:'#cbc6ba',glass:'#2c4054'},{k:'office',wall:'#8b939a',glass:'#223445'},{k:'brick',wall:'#8a4a36',glass:'#26313c'},{k:'brick',wall:'#9d6a52',glass:'#28343f'},{k:'stone',wall:'#cdbfa1',glass:'#2b3b4a'},{k:'stone',wall:'#b9b2a6',glass:'#27384a'}];
function facadeMat(st){const S=256,col=mkc(S,S),hgt=mkc(S,S),rm=mkc(S,S),gc=col.getContext('2d'),gh=hgt.getContext('2d'),gr=rm.getContext('2d');
 noise(gc,S,S,st.wall,0.08);gh.fillStyle='#fff';gh.fillRect(0,0,S,S);gr.fillStyle='rgb(0,217,0)';gr.fillRect(0,0,S,S);const gm=st.k==='glass'?70:40;
 const pane=(x,y,w,h)=>{const gg=gc.createLinearGradient(0,y,0,y+h);gg.addColorStop(0,shade(st.glass,2.1));gg.addColorStop(0.45,shade(st.glass,1.35));gg.addColorStop(1,shade(st.glass,1.0));gc.fillStyle=gg;gc.fillRect(x,y,w,h);gc.fillStyle='rgba(255,255,255,0.07)';gc.beginPath();gc.moveTo(x+w*0.2,y);gc.lineTo(x+w*0.45,y);gc.lineTo(x+w*0.15,y+h);gc.lineTo(x,y+h);gc.fill();gh.fillStyle='#5a5a5a';gh.fillRect(x,y,w,h);gr.fillStyle='rgb(0,64,'+gm+')';gr.fillRect(x,y,w,h);};
 const frame=(x,y,w,h,c)=>{gc.fillStyle=c;gc.fillRect(x,y,w,h);gh.fillStyle='#d4d4d4';gh.fillRect(x,y,w,h);gr.fillStyle='rgb(0,120,90)';gr.fillRect(x,y,w,h);};
 const band=(x,y,w,h,c,hv)=>{gc.fillStyle=c;gc.fillRect(x,y,w,h);gh.fillStyle=hv;gh.fillRect(x,y,w,h);gr.fillStyle='rgb(0,205,0)';gr.fillRect(x,y,w,h);};
 if(st.k==='glass'){pane(0,0,S,S);frame(0,0,3,S,'#59606a');frame(125,0,6,S,'#59606a');frame(S-3,0,3,S,'#59606a');band(0,224,S,32,shade(st.wall,0.85),'#f4f4f4');frame(0,221,S,3,'#59606a');}
 else if(st.k==='office'){band(0,0,S,S,st.wall,'#ffffff');noise(gc,S,S,'rgba(0,0,0,0)',0.06);pane(0,72,S,118);for(let x=0;x<=S;x+=64)frame(Math.min(S-4,Math.max(0,x-2)),72,4,118,'#3a3f45');frame(0,70,S,3,'#3a3f45');frame(0,189,S,3,'#3a3f45');band(0,192,S,6,shade(st.wall,1.08),'#ffffff');}
 else if(st.k==='brick'){gc.fillStyle='#6f6a62';gc.fillRect(0,0,S,S);gh.fillStyle='#b8b8b8';gh.fillRect(0,0,S,S);for(let y=0;y<S;y+=8){const off=(y/8)%2?0:8;for(let x=-16;x<S;x+=16){gc.fillStyle=shade(st.wall,rand(0.8,1.12));gc.fillRect(x+off+1,y+1,14,6);gh.fillStyle='#ffffff';gh.fillRect(x+off+1,y+1,14,6);}}
  for(const x of[38,148]){band(x-6,52,82,7,'#cfc8b8','#ffffff');pane(x,60,70,140);frame(x+33,60,4,140,'#e6e0d4');frame(x,126,70,4,'#e6e0d4');frame(x,60,70,3,'#e6e0d4');band(x-8,200,86,9,'#d8d1c1','#ffffff');}}
 else{band(0,0,S,S,st.wall,'#ffffff');noise(gc,S,S,'rgba(0,0,0,0)',0.07);for(let y=0;y<S;y+=32){gc.fillStyle='rgba(0,0,0,.14)';gc.fillRect(0,y,S,2);gh.fillStyle='#d0d0d0';gh.fillRect(0,y,S,2);}for(let y=0;y<S;y+=32)for(let x=(y/32)%2?0:32;x<S;x+=64){gc.fillStyle='rgba(0,0,0,.1)';gc.fillRect(x,y,2,32);gh.fillStyle='#d8d8d8';gh.fillRect(x,y,2,32);}
  pane(72,48,112,160);frame(72,48,112,5,'#e8e2d4');frame(72,203,112,5,'#e8e2d4');frame(126,48,4,160,'#e8e2d4');frame(72,120,112,4,'#e8e2d4');band(64,208,128,11,'#ddd6c6','#ffffff');band(0,0,S,14,shade(st.wall,1.1),'#ffffff');}
 return withAO(new THREE.MeshStandardMaterial({map:tex(col),normalMap:normalMapFrom(hgt,3),normalScale:new THREE.Vector2(0.55,0.55),roughnessMap:tex(rm,true),metalnessMap:tex(rm,true),roughness:1,metalness:1}));}
STY.forEach(st=>{st.mat=facadeMat(st);st.hex=parseInt(st.wall.slice(1),16);});
const shopMats=['#b8322a','#1f5f8b','#2f6b3a','#c9a227'].map(sign=>{const col=mkc(256,256,g=>{g.fillStyle='#2b2d31';g.fillRect(0,0,256,256);g.fillStyle=sign;g.fillRect(0,4,256,42);g.fillStyle='rgba(255,255,255,.9)';for(let i=0;i<6;i++)g.fillRect(36+i*32,18,22,14);const gg=g.createLinearGradient(0,60,0,256);gg.addColorStop(0,'#7e98ae');gg.addColorStop(0.5,'#3b4f61');gg.addColorStop(1,'#1d2a36');g.fillStyle=gg;g.fillRect(10,60,236,196);g.fillStyle='#2b2d31';g.fillRect(124,60,8,196);g.fillStyle='rgba(255,226,170,.22)';g.fillRect(14,160,106,92);g.fillRect(136,160,106,92);g.fillStyle='rgba(255,255,255,.08)';g.beginPath();g.moveTo(30,60);g.lineTo(80,60);g.lineTo(30,256);g.lineTo(14,256);g.fill();});
 const rm=mkc(256,256,g=>{g.fillStyle='rgb(0,110,170)';g.fillRect(0,0,256,256);g.fillStyle='rgb(0,18,130)';g.fillRect(10,60,236,196);g.fillStyle='rgb(0,150,0)';g.fillRect(0,4,256,42);});
 const hg=mkc(256,256,g=>{g.fillStyle='#fff';g.fillRect(0,0,256,256);g.fillStyle='#6a6a6a';g.fillRect(10,60,236,196);g.fillStyle='#fff';g.fillRect(124,60,8,196);g.fillStyle='#e0e0e0';g.fillRect(0,4,256,42);});
 return withAO(new THREE.MeshStandardMaterial({map:tex(col),normalMap:normalMapFrom(hg,2),roughnessMap:tex(rm,true),metalnessMap:tex(rm,true),roughness:1,metalness:1}));});
const concT=cv(256,256,(g,w,h)=>{noise(g,w,h,'#bdb8ae',0.12);for(let i=0;i<30;i++){g.fillStyle='rgba(0,0,0,'+rand(0.02,0.06).toFixed(2)+')';g.fillRect(rand(0,w),rand(0,h),rand(4,40),rand(20,120));}});
const detailMat=M(0xffffff,0.9,{map:concT});

const roofMat=M(0x55585b,0.95,{map:cv(256,256,(g,w,h)=>{noise(g,w,h,'#8a8d90',0.18);g.strokeStyle='rgba(0,0,0,.15)';for(let i=0;i<=8;i++){g.beginPath();g.moveTo(i*32,0);g.lineTo(i*32,h);g.stroke();}})}),acMat=M(0xaeb2b6,0.45,{metalness:0.6}),rubbleMat=M(0xffffff,1,{map:rubbleT});
const boxGeo=new THREE.BoxGeometry(1,1,1);
const dm=new THREE.Object3D();

/* ---------- city ---------- */
let ARENA=false;const _SC0=scene.children.length;
const BLOCK=44,ROAD=14,PITCH=58,N=13,HALF=N*PITCH/2,CI=(N-1)/2;

const cityW=2*1300+60;asphaltT.repeat.set(cityW/12,cityW/12);
/* ---------- river with embankments, bridges and boats ---------- */
const RJ=CI+3,RZ0=-HALF+ROAD/2+RJ*PITCH,RZ1=RZ0+BLOCK,WATER_Y=-1.3;
const onBridgeX=x=>{const m=(((x+HALF)%PITCH)+PITCH)%PITCH;return m<ROAD/2+1.2||m>PITCH-ROAD/2-1.2;};
const inRiver=(x,z)=>!ARENA&&z>RZ0&&z<RZ1&&!onBridgeX(x);
const ASPH_MATS=[],GRASS_MATS=[];function groundStrip(mat,y,z0,z1,w){(y>0?ASPH_MATS:GRASS_MATS).push(mat);const g=new THREE.Mesh(new THREE.PlaneGeometry(w,z1-z0),mat);g.rotation.x=-Math.PI/2;g.position.set(0,y,(z0+z1)/2);g.receiveShadow=true;scene.add(g);return g;}
{const gT1=grassT.clone(),gT2=grassT.clone();gT1.needsUpdate=gT2.needsUpdate=true;gT1.repeat.set(600,600*(RZ0+2600)/5200);gT2.repeat.set(600,600*(2600-RZ1)/5200);
 groundStrip(M(0xffffff,0.95,{map:gT1}),-0.45,-2600,RZ0,5200);groundStrip(M(0xffffff,0.95,{map:gT2}),-0.45,RZ1,2600,5200);
 const cw=2*1300+60,aT1=asphaltT.clone(),aT2=asphaltT.clone();aT1.needsUpdate=aT2.needsUpdate=true;aT1.repeat.set(cw/12,(RZ0+cw/2)/12);aT2.repeat.set(cw/12,(cw/2-RZ1)/12);
 groundStrip(M(0xffffff,0.95,{map:aT1}),0.02,-cw/2,RZ0,cw);groundStrip(M(0xffffff,0.95,{map:aT2}),0.02,RZ1,cw/2,cw);}
const waterN=normalMapFrom(mkc(256,256,(g,w,h)=>{g.fillStyle='#808080';g.fillRect(0,0,w,h);for(let i=0;i<260;i++){const v=Math.round(rand(70,190));g.fillStyle='rgb('+v+','+v+','+v+')';g.beginPath();g.ellipse(rand(0,w),rand(0,h),rand(6,26),rand(2,7),rand(-0.3,0.3),0,6.3);g.fill();}}),1.6);waterN.repeat.set(160,4);
const waterMat=new THREE.MeshStandardMaterial({color:lin(0x24525e),roughness:0.16,metalness:0.15,normalMap:waterN,normalScale:new THREE.Vector2(0.55,0.55),envMapIntensity:0.9});
{const L=2660,mid=(RZ0+RZ1)/2;const water=new THREE.Mesh(new THREE.PlaneGeometry(L,BLOCK),waterMat);water.rotation.x=-Math.PI/2;water.position.set(0,WATER_Y,mid);water.receiveShadow=true;scene.add(water);
 const bed=new THREE.Mesh(new THREE.PlaneGeometry(L,BLOCK),M(0x2e3a32,1));bed.rotation.x=-Math.PI/2;bed.position.set(0,-3.5,mid);scene.add(bed);
 const wallM=M(0x9a958a,0.9,{map:concT});for(const z of[RZ0-0.5,RZ1+0.5]){const w=new THREE.Mesh(new THREE.BoxGeometry(L,3.6,1),wallM);w.position.set(0,-1.78,z);w.receiveShadow=true;scene.add(w);}
 const rail=[],decks=[],deckRail=[];for(let i=-30;i<=40;i++){const c=-HALF+i*PITCH;if(Math.abs(c)>1310)continue;decks.push(c);const a=c+ROAD/2+1.2,b=c+PITCH-ROAD/2-1.2;if(b-a>2)for(const z of[RZ0+0.15,RZ1-0.15])rail.push([(a+b)/2,z,b-a]);}
 const railI=new THREE.InstancedMesh(boxGeo,M(0x3a3f45,0.5,{metalness:0.6}),rail.length);rail.forEach((q,i)=>{dm.position.set(q[0],0.6,q[1]);dm.rotation.set(0,0,0);dm.scale.set(q[2],0.08,0.08);dm.updateMatrix();railI.setMatrixAt(i,dm.matrix);});scene.add(railI);
 const postI=new THREE.InstancedMesh(boxGeo,M(0x3a3f45,0.5,{metalness:0.6}),rail.length*2);rail.forEach((q,i)=>{for(const s of[-1,1]){dm.position.set(q[0]+s*q[2]/2,0.3,q[1]);dm.scale.set(0.12,0.6,0.12);dm.updateMatrix();postI.setMatrixAt(i*2+(s>0?1:0),dm.matrix);}});scene.add(postI);
 const deckI=new THREE.InstancedMesh(boxGeo,M(0x8d8a84,0.9,{map:concT}),decks.length),archI=new THREE.InstancedMesh(boxGeo,M(0x7f7b74,0.9,{map:concT}),decks.length),brailI=new THREE.InstancedMesh(boxGeo,M(0x3a3f45,0.5,{metalness:0.6}),decks.length*2);
 decks.forEach((c,i)=>{dm.position.set(c,-0.6,mid);dm.scale.set(ROAD+2.4,1.24,BLOCK+1.2);dm.updateMatrix();deckI.setMatrixAt(i,dm.matrix);dm.position.set(c,-1.8,mid);dm.scale.set(ROAD,1.2,BLOCK*0.7);dm.updateMatrix();archI.setMatrixAt(i,dm.matrix);for(const s of[-1,1]){dm.position.set(c+s*(ROAD/2+1.1),0.55,mid);dm.scale.set(0.15,1.1,BLOCK+1.2);dm.updateMatrix();brailI.setMatrixAt(i*2+(s>0?1:0),dm.matrix);}});
 for(const m of[deckI,archI,brailI,railI,postI]){m.castShadow=m.receiveShadow=true;m.frustumCulled=false;scene.add(m);}}
const boats=[];{const hullG=roundedBox(2.6,1.1,8,0.45),cabG=roundedBox(1.9,1.2,3,0.25);for(let i=0;i<7;i++){const g=new THREE.Group();const hull=new THREE.Mesh(hullG,M(pick([0xe9e9e6,0x1f4fa8,0x7a1f24,0x2f7a3a]),0.5));hull.position.y=0.1;const cab=new THREE.Mesh(cabG,M(0xf2efe8,0.5));cab.position.set(0,1.1,-0.6);const win=new THREE.Mesh(roundedBox(1.95,0.45,2.6,0.1),M(0x18212b,0.1,{metalness:0.6}));win.position.set(0,1.25,-0.6);g.add(hull,cab,win);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});const dir=i%2?1:-1;g.rotation.y=dir>0?Math.PI/2:-Math.PI/2;g.position.set(rand(-1200,1200),WATER_Y,(RZ0+RZ1)/2+dir*(-8)+rand(-3,3));scene.add(g);boats.push({g,dir,sp:rand(5,9),ph:rand(0,6)});}}
function updateBoats(dt){for(const b of boats){b.g.position.x+=b.dir*b.sp*dt;if(b.g.position.x>1300)b.g.position.x=-1300;if(b.g.position.x<-1300)b.g.position.x=1300;b.ph+=dt;b.g.position.y=WATER_Y+Math.sin(b.ph*1.3)*0.06;b.g.rotation.z=Math.sin(b.ph*0.9)*0.025;
  if(Math.random()<dt*14){const p=b.g.position;emit(dustPS,p.x-b.dir*4,WATER_Y+0.2,p.z+rand(-1,1),-b.dir*rand(0.5,1.5),rand(0,0.4),rand(-0.6,0.6),1.4,0.6,2.2,0.92,0.95,0.97,0.55,0.8,0);}}
 waterN.offset.x+=dt*0.004;waterN.offset.y+=dt*0.01;}

const slabGeo=new THREE.PlaneGeometry(BLOCK,BLOCK);slabGeo.rotateX(-Math.PI/2);const slabMat=M(0xffffff,0.9,{map:walkT});
const parkGeo=new THREE.PlaneGeometry(BLOCK-6,BLOCK-6);parkGeo.rotateX(-Math.PI/2);const parkMat=M(0xffffff,0.95,{map:parkT});
const buildings=[],treeSpots=[];
function scaleBoxUV(geo,w,h,d,tu,tv){tu=tu||5;tv=tv||4;const uv=geo.attributes.uv;const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let f=0;f<6;f++){const su=dims[f][0]/tu,sv=dims[f][1]/tv;for(let k=0;k<4;k++){const i=f*4+k;uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);}}uv.needsUpdate=true;}
function mergeBoxes(parts){const pos=[],nor=[],uv=[],idx=[];let off=0;for(const q of parts){const g=new THREE.BoxGeometry(q.w,q.h,q.d);g.translate(q.x,q.y,q.z);const a=g.attributes;for(let i=0;i<a.position.count;i++){pos.push(a.position.getX(i),a.position.getY(i),a.position.getZ(i));nor.push(a.normal.getX(i),a.normal.getY(i),a.normal.getZ(i));uv.push(a.uv.getX(i)*Math.max(q.w,q.d)/6,a.uv.getY(i)*Math.max(q.h,1)/6);}for(let i=0;i<g.index.count;i++)idx.push(g.index.getX(i)+off);off+=a.position.count;g.dispose();}
 const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));bg.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));bg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));bg.setIndex(idx);return bg;}
function rubbleGeo(w,d){const parts=[];for(let i=0;i<34;i++){const px=rand(-0.5,0.5),pz=rand(-0.5,0.5),c=1-Math.max(Math.abs(px),Math.abs(pz))*1.4,s=rand(1,3.5);parts.push({w:s*rand(0.8,1.6),h:rand(0.6,1)*(1+c*3.5),d:s*rand(0.8,1.6),x:px*w,y:rand(0,1)*c*1.2,z:pz*d});}return mergeBoxes(parts);}
function buildingGeo(w,h,d){const g=new THREE.BoxGeometry(w,h,d);scaleBoxUV(g,w,h,d);const src=g.index.array,idx=[];for(const f of[0,1,4,5])for(let k=0;k<6;k++)idx.push(src[f*6+k]);for(const f of[2,3])for(let k=0;k<6;k++)idx.push(src[f*6+k]);g.setIndex(idx);g.clearGroups();g.addGroup(0,24,0);g.addGroup(24,12,1);return g;}
function mergeParts(parts){const pos=[],nor=[],uv=[],idx=[];let off=0;for(const q of parts){const g=new THREE.BoxGeometry(q.w,q.h,q.d);g.translate(q.x,q.y,q.z);const a=g.attributes;
 for(let i=0;i<a.position.count;i++){pos.push(a.position.getX(i),a.position.getY(i),a.position.getZ(i));nor.push(a.normal.getX(i),a.normal.getY(i),a.normal.getZ(i));const f=Math.floor(i/4),u0=a.uv.getX(i),v0=a.uv.getY(i);if(q.shop&&f!==2&&f!==3)uv.push(u0*(f<2?q.d:q.w)/5,0.5+v0*0.5);else uv.push(u0*Math.max(q.w,q.d)/8,0.02+v0*0.46);}
 for(let i=0;i<g.index.count;i++)idx.push(g.index.getX(i)+off);off+=a.position.count;g.dispose();}
 const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));bg.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));bg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));bg.setIndex(idx);return bg;}
function drawShop(g,sign,oy){g.fillStyle='#2b2d31';g.fillRect(0,oy,256,256);g.fillStyle=sign;g.fillRect(0,oy+4,256,42);g.fillStyle='rgba(255,255,255,.9)';for(let i=0;i<6;i++)g.fillRect(36+i*32,oy+18,22,14);const gg=g.createLinearGradient(0,oy+60,0,oy+256);gg.addColorStop(0,'#8aa3b8');gg.addColorStop(0.5,'#4a6073');gg.addColorStop(1,'#243442');g.fillStyle=gg;g.fillRect(10,oy+60,236,196);g.fillStyle='#2b2d31';g.fillRect(124,oy+60,8,196);g.fillStyle='rgba(255,226,170,.3)';g.fillRect(14,oy+160,106,92);g.fillRect(136,oy+160,106,92);g.fillStyle='rgba(255,255,255,.1)';g.beginPath();g.moveTo(30,oy+60);g.lineTo(80,oy+60);g.lineTo(30,oy+256);g.lineTo(14,oy+256);g.fill();}
const atlasMats=['#b8322a','#1f5f8b','#2f6b3a','#c9a227','#7a3f8f','#d0661f'].map(sign=>{
 const col=mkc(256,512,g=>{drawShop(g,sign,0);g.save();g.translate(0,256);noise(g,256,256,'#bdb8ae',0.12);for(let i=0;i<30;i++){g.fillStyle='rgba(0,0,0,'+rand(0.02,0.06).toFixed(2)+')';g.fillRect(rand(0,256),rand(0,256),rand(4,40),rand(20,120));}g.restore();});
 const rm=mkc(256,512,g=>{g.fillStyle='rgb(0,110,170)';g.fillRect(0,0,256,256);g.fillStyle='rgb(0,18,130)';g.fillRect(10,60,236,196);g.fillStyle='rgb(0,150,0)';g.fillRect(0,4,256,42);g.fillStyle='rgb(0,230,0)';g.fillRect(0,256,256,256);});
 const hg=mkc(256,512,g=>{g.fillStyle='#fff';g.fillRect(0,0,256,512);g.fillStyle='#6a6a6a';g.fillRect(10,60,236,196);g.fillStyle='#fff';g.fillRect(124,60,8,196);g.fillStyle='#e0e0e0';g.fillRect(0,4,256,42);});
 return withAO(new THREE.MeshStandardMaterial({map:tex(col),normalMap:normalMapFrom(hg,2),roughnessMap:tex(rm,true),metalnessMap:tex(rm,true),roughness:1,metalness:1}));});
const ADS=[['#c62a34','#ffffff','GÖKSU COLA','Serinliğin tadı'],['#10233f','#7fd0ff','NOVA X','Yeni nesil telefon'],['#e8b923','#1b1d22','LEZZET BURGER','İkinci menü bizden'],['#1f6b5c','#ffffff','YAZ TATİLİ','Ege kıyısında 7 gece'],['#121a2e','#e8b923','GÖK MUHAFIZI 3','Yakında sinemalarda'],['#f2efe8','#1f4fa8','HIZLI KARGO','Aynı gün teslimat']];
const adMats=ADS.map(([bg,fg,title,sub])=>{const t=cv(512,256,(g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);g.fillStyle='rgba(255,255,255,.08)';for(let i=0;i<6;i++){g.beginPath();g.arc(rand(0,w),rand(0,h),rand(40,140),0,6.3);g.fill();}g.fillStyle=fg;g.textBaseline='middle';g.font='bold 72px "Saira Condensed","Arial Narrow",Arial,sans-serif';g.fillText(title,34,100,450);g.font='500 34px Saira,Arial,sans-serif';g.globalAlpha=0.85;g.fillText(sub,38,180,440);g.globalAlpha=1;g.fillRect(34,212,120,8);});return new THREE.MeshStandardMaterial({map:t,emissive:0xffffff,emissiveMap:t,emissiveIntensity:0.45,roughness:0.5});});
const adGeo=new THREE.PlaneGeometry(10,4.5);
const heliMat=M(0xffffff,0.8,{map:cv(256,256,(g,w,h)=>{g.fillStyle='#4a4d52';g.fillRect(0,0,w,h);g.strokeStyle='#e8e4d8';g.lineWidth=10;g.beginPath();g.arc(128,128,100,0,6.3);g.stroke();g.fillStyle='#e8e4d8';g.fillRect(88,70,22,116);g.fillRect(146,70,22,116);g.fillRect(88,117,80,22);})});
const padGeo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
const tankGeo=new THREE.CylinderGeometry(1.4,1.4,3,16),tankMat=M(0x6b4a33,0.85);
/* building variety: tiers, round towers, roofs, houses, landmarks */
const prismGeo=(()=>{const s=new THREE.Shape();s.moveTo(-0.5,0);s.lineTo(0.5,0);s.lineTo(0,1);s.lineTo(-0.5,0);const g=new THREE.ExtrudeGeometry(s,{depth:1,bevelEnabled:false});g.translate(0,0,-0.5);g.computeVertexNormals();return g;})();
const tileT=cv(128,128,(g,w,h)=>{g.fillStyle='#bdbdbd';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=8){g.fillStyle='rgba(0,0,0,.25)';g.fillRect(0,y,w,2);for(let x=(y/8)%2?0:8;x<w;x+=16){g.fillStyle='rgba(0,0,0,.12)';g.fillRect(x,y,1,8);}}});tileT.repeat.set(3,3);
const tileMats=[0x9a4a32,0x7a3b2a,0x4a4d52,0x5a4632,0x3a3f45].map(c=>M(c,0.8,{map:tileT}));
const copperM=M(0x5f8f7a,0.75,{metalness:0.1}),spireM=M(0xc9ccd2,0.45,{metalness:0.6}),darkRoofM=M(0x2e3134,0.8,{metalness:0.05});
function cylBuildingGeo(r,h){const g=new THREE.CylinderGeometry(r,r,h,36,1);const uv=g.attributes.uv,su=2*Math.PI*r/5,sv=h/4;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);uv.needsUpdate=true;return g;}
function makeBuilding(x,z,w,d,h,si,zone,opt){opt=opt||{};const y0=opt.y0||0,st=STY[si],cyl=!!opt.cyl,r=Math.min(w,d)/2;
 const mesh=new THREE.Mesh(cyl?cylBuildingGeo(r,h):buildingGeo(w,h,d),cyl?[st.mat,roofMat,roofMat]:[st.mat,roofMat]);mesh.position.set(x,y0+h/2,z);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
 const top=h/2,parts=[];
 if(!cyl){if(!y0&&!opt.noPlinth)parts.push({shop:true,w:w+0.5,h:4.6,d:d+0.5,x:0,y:-h/2+2.3,z:0},{w:w+0.9,h:0.45,d:d+0.9,x:0,y:-h/2+4.8,z:0});
  if(!opt.roof||opt.roof==='flat'){const t=0.4,ph=st.k==='glass'?0.7:1.2,oy=h/2+ph/2-0.2;parts.push({w:w+0.7,h:ph,d:t,x:0,y:oy,z:d/2+0.15},{w:w+0.7,h:ph,d:t,x:0,y:oy,z:-d/2-0.15},{w:t,h:ph,d:d+0.7,x:w/2+0.15,y:oy,z:0},{w:t,h:ph,d:d+0.7,x:-w/2-0.15,y:oy,z:0});}
  if(st.k==='stone'||st.k==='office')for(let yy=12;yy<h-4;yy+=12)parts.push({w:w+0.35,h:0.35,d:d+0.35,x:0,y:-h/2+yy,z:0});
  if(!y0&&(st.k==='brick'||st.k==='stone')&&h<48&&h>12&&Math.random()<0.6){for(let fy=8.2;fy<h-3;fy+=3.6)for(let bx=-w/2+2.5;bx<w/2-1.5;bx+=5)if(Math.random()<0.75){parts.push({w:3,h:0.15,d:1.1,x:bx,y:-h/2+fy,z:d/2+0.55},{w:3,h:0.9,d:0.06,x:bx,y:-h/2+fy+0.45,z:d/2+1.08},{w:0.06,h:0.9,d:1.1,x:bx-1.5,y:-h/2+fy+0.45,z:d/2+0.55},{w:0.06,h:0.9,d:1.1,x:bx+1.5,y:-h/2+fy+0.45,z:d/2+0.55});}}
  if(!y0&&st.k==='brick'&&h>12&&Math.random()<0.5){for(let fy=8.2;fy<h-3;fy+=3.6){parts.push({w:1.2,h:0.12,d:4,x:w/2+0.6,y:-h/2+fy,z:0},{w:0.05,h:0.9,d:4,x:w/2+1.18,y:-h/2+fy+0.45,z:0},{w:0.4,h:3.6,d:0.06,x:w/2+0.9,y:-h/2+fy-1.8,z:(fy/3.6)%2<1?1.5:-1.5});}}
  if(!opt.roof||opt.roof==='flat'){const nAc=opt.top===false?0:randi(1,3);for(let i=0;i<nAc;i++){const aw=rand(1.8,3.5),ah=rand(1,2),ad=rand(1.8,3.5);parts.push({w:aw,h:ah,d:ad,x:rand(-w/2+2.5,w/2-2.5),y:top+ah/2,z:rand(-d/2+2.5,d/2-2.5)});}
   if(opt.top!==false&&Math.random()<0.6)parts.push({w:3.2,h:3,d:3.2,x:rand(-w/4,w/4),y:top+1.5,z:rand(-d/4,d/4)});}
  if(opt.bill&&h>16&&w>10.5){parts.push({w:0.4,h:4,d:0.4,x:-3.5,y:top+2,z:-0.5},{w:0.4,h:4,d:0.4,x:3.5,y:top+2,z:-0.5},{w:10.4,h:4.9,d:0.3,x:0,y:top+6,z:-0.2});const ad=new THREE.Mesh(adGeo,pick(adMats));ad.position.set(0,top+6,0);mesh.add(ad);}
  if(parts.length){const det=new THREE.Mesh(mergeParts(parts),pick(atlasMats));det.castShadow=true;det.receiveShadow=true;mesh.add(det);}}
 else{const ring=new THREE.Mesh(new THREE.CylinderGeometry(r+0.25,r+0.25,1.0,36,1,true),detailMat);ring.position.y=top-0.3;mesh.add(ring);if(!y0){const base=new THREE.Mesh(new THREE.CylinderGeometry(r+0.4,r+0.4,4.6,36),pick(atlasMats));base.position.y=-h/2+2.3;base.receiveShadow=true;mesh.add(base);}}
 const R=opt.roof;let rm=null;
 if(R==='gable'){rm=new THREE.Mesh(prismGeo,pick(tileMats));rm.scale.set(w+0.7,Math.min(w,d)*0.38,d+0.5);rm.position.y=top;if(Math.random()<0.5)rm.rotation.y=Math.PI/2,rm.scale.set(d+0.7,Math.min(w,d)*0.38,w+0.5);}
 else if(R==='pyramid'){rm=new THREE.Mesh(new THREE.ConeGeometry(1,1,4),Math.random()<0.5?copperM:darkRoofM);rm.rotation.y=Math.PI/4;rm.scale.set(Math.max(w,d)*0.72,Math.min(w,d)*0.55,Math.max(w,d)*0.72);rm.position.y=top+Math.min(w,d)*0.275;}
 else if(R==='dome'){const drum=new THREE.Mesh(new THREE.CylinderGeometry(r*0.55,r*0.6,r*0.35,32),detailMat);drum.position.y=top+r*0.175;mesh.add(drum);rm=new THREE.Mesh(new THREE.SphereGeometry(r*0.55,32,16,0,Math.PI*2,0,Math.PI/2),copperM);rm.position.y=top+r*0.35;const lan=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.6,2.5,12),copperM);lan.position.y=top+r*0.35+r*0.55+1;mesh.add(lan);}
 else if(R==='spire'){const sh=opt.spireH||rand(18,32);rm=new THREE.Mesh(new THREE.ConeGeometry(Math.min(w,d)*0.16,sh,8),spireM);rm.position.y=top+sh/2;const crown=new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w,d)*0.3,Math.min(w,d)*0.38,3,cyl?36:4),spireM);if(!cyl)crown.rotation.y=Math.PI/4;crown.position.y=top+1.5;mesh.add(crown);}
 else if(R==='crown'){rm=new THREE.Mesh(new THREE.CylinderGeometry(r*0.75,r*0.92,4,36),darkRoofM);rm.position.y=top+2;const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.25,14,8),spireM);ant.position.y=top+11;mesh.add(ant);}
 if(rm){rm.castShadow=true;rm.receiveShadow=true;mesh.add(rm);}
 if(!cyl&&!R&&st.k==='glass'&&h>85&&!opt.noPad&&Math.random()<0.5){const p=new THREE.Mesh(padGeo,heliMat);const s=Math.min(w,d)*0.8;p.scale.set(s,1,s);p.position.y=top+0.06;mesh.add(p);}
 if(!cyl&&!R&&st.k==='brick'&&h>10&&Math.random()<0.4){const tk=new THREE.Mesh(tankGeo,tankMat);tk.position.set(rand(-w/4,w/4),top+3.2,rand(-d/4,d/4));tk.castShadow=true;mesh.add(tk);}
 const hp=80+w*d*h*0.045;
 const b={cyl,si,mesh,x,z,w,d,h,y0,hp,maxHp:hp,alive:true,col:{minX:x-w/2,maxX:x+w/2,minY:y0,maxY:y0+h,minZ:z-d/2,maxZ:z+d/2},shake:0,collapse:-1,tilt:new V3(),respawnAt:0,rubble:null,smokeT:0,lastRam:-9,wallColor:st.hex,dustT:0,ai:buildings.length,kids:[],parentB:opt.parent||null};
 buildings.push(b);if(opt.parent)opt.parent.kids.push(b);return b;}
function tower(x,z,w,d,H,zone,kind){
 if(kind==='setback'){const si=randi(0,2),h1=H*0.45,h2=H*0.32,h3=H-h1-h2;const a=makeBuilding(x,z,w,d,h1,si,zone,{top:false});const b=makeBuilding(x,z,w*0.78,d*0.78,h2,si,zone,{y0:h1,parent:a,top:false});makeBuilding(x,z,w*0.56,d*0.56,h3,si,zone,{y0:h1+h2,parent:b,roof:Math.random()<0.5?'spire':null});}
 else if(kind==='podium'){const ph=rand(10,16);const a=makeBuilding(x,z,18.4,18.4,ph,pick([3,4,7,8]),zone,{});makeBuilding(x,z,w*0.62,d*0.62,H-ph,randi(0,2),zone,{y0:ph,parent:a,roof:Math.random()<0.3?'crown':null});}
 else if(kind==='cyl'){makeBuilding(x,z,Math.min(w,d),Math.min(w,d),H,randi(0,2),zone,{cyl:true,roof:pick(['crown','spire',null])});}
 else makeBuilding(x,z,w,d,H,Math.random()<0.8?randi(0,2):pick([3,4,7,8]),zone,{});}
const LANDMARK={};LANDMARK[(CI+1)+','+CI]='supertall';LANDMARK[(CI-1)+','+CI]='roundtower';LANDMARK[CI+','+(CI+1)]='civic';LANDMARK[CI+','+(CI-1)]='church';
const sites=[],cranes=[],siteBlocks=new Set();while(siteBlocks.size<6){const bi=randi(1,N-2),bj=randi(1,N-2);if(bi===CI&&bj===CI)continue;siteBlocks.add(bi+','+bj);}
const yellowM=M(0xe0b020,0.55,{metalness:0.3}),darkM=M(0x2a2d31,0.5,{metalness:0.5});
function buildSite(x,z,size,tall){const hs=tall?rand(40,70):rand(18,32),parts=[];for(let y=0;y<=hs;y+=3.6){parts.push({w:size,h:0.35,d:size,x:0,y:y+0.17,z:0});if(y<hs)for(const cx of[-1,0,1])for(const cz of[-1,0,1])parts.push({w:0.5,h:3.6,d:0.5,x:cx*(size/2-0.4),y:y+1.8,z:cz*(size/2-0.4)});}
 const sk=new THREE.Mesh(mergeBoxes(parts),detailMat);sk.position.set(x,0,z);sk.castShadow=sk.receiveShadow=true;scene.add(sk);
 const hc=hs+22,mx=x+size/2-1.2,mz=z+size/2-1.2,mp=[];for(const a of[-0.8,0.8])for(const b of[-0.8,0.8])mp.push({w:0.22,h:hc,d:0.22,x:a,y:hc/2,z:b});for(let y=2;y<hc;y+=2.5){mp.push({w:1.8,h:0.12,d:0.12,x:0,y,z:0.8},{w:1.8,h:0.12,d:0.12,x:0,y,z:-0.8},{w:0.12,h:0.12,d:1.8,x:0.8,y,z:0},{w:0.12,h:0.12,d:1.8,x:-0.8,y,z:0});}
 const mast=new THREE.Mesh(mergeBoxes(mp),yellowM);mast.position.set(mx,0,mz);mast.castShadow=true;scene.add(mast);
 const topG=new THREE.Group();topG.position.set(mx,hc,mz);const jib=new THREE.Mesh(mergeBoxes([{w:46,h:1.3,d:1.3,x:22,y:0.65,z:0},{w:14,h:1,d:1.8,x:-7,y:0.5,z:0},{w:1.2,h:6,d:1.2,x:0,y:3,z:0},{w:2.6,h:2.2,d:2.6,x:1.6,y:-1.1,z:0}]),yellowM);jib.castShadow=true;topG.add(jib);
 const cw=new THREE.Mesh(boxGeo,darkM);cw.scale.set(3,2.4,2.2);cw.position.set(-12,-0.8,0);topG.add(cw);const cable=new THREE.Mesh(boxGeo,darkM);cable.scale.set(0.06,20,0.06);cable.position.set(30,-10,0);topG.add(cable);const hook=new THREE.Mesh(boxGeo,yellowM);hook.scale.set(1,0.8,1);hook.position.set(30,-20,0);topG.add(hook);
 topG.rotation.y=rand(0,6.28);scene.add(topG);cranes.push({g:topG,sp:rand(0.03,0.07)*(Math.random()<.5?-1:1)});}
for(let bi=0;bi<N;bi++)for(let bj=0;bj<N;bj++){
 const x0=-HALF+ROAD/2+bi*PITCH,z0=-HALF+ROAD/2+bj*PITCH,cx=x0+BLOCK/2,cz=z0+BLOCK/2;
 const slab=new THREE.Mesh(slabGeo,slabMat);slab.position.set(cx,0.06,cz);slab.receiveShadow=true;scene.add(slab);
 if(bj===RJ){scene.remove(slab);continue;}
 const plaza=bi===CI&&bj===CI,dist=Math.hypot(cx,cz)/HALF,site=siteBlocks.has(bi+','+bj),lm=LANDMARK[bi+','+bj];
 if(plaza||(dist>0.35&&!site&&!lm&&Math.random()<0.05)){const pk=new THREE.Mesh(parkGeo,parkMat);pk.position.set(cx,0.09,cz);pk.receiveShadow=true;scene.add(pk);
  for(let k=0;k<(plaza?14:16);k++){const tx=cx+rand(-18,18),tz=cz+rand(-18,18);if(plaza&&Math.hypot(tx,tz)<9)continue;treeSpots.push({x:tx,z:tz});}continue;}
 const zone=dist<0.42?'down':dist<0.78?'mid':'out';
 if(lm){const lx=x0+2+9.5,lz=z0+2+9.5;
  if(lm==='supertall'){const a=makeBuilding(lx,lz,18.5,18.5,90,0,'down',{top:false});const b=makeBuilding(lx,lz,14.5,14.5,70,0,'down',{y0:90,parent:a,top:false});const c=makeBuilding(lx,lz,10.5,10.5,45,0,'down',{y0:160,parent:b,top:false});makeBuilding(lx,lz,6.5,6.5,20,0,'down',{y0:205,parent:c,roof:'spire',spireH:45});}
  else if(lm==='roundtower')makeBuilding(lx,lz,18,18,170,1,'down',{cyl:true,roof:'crown'});
  else if(lm==='civic'){const a=makeBuilding(x0+22,z0+12,38,18,22,7,'down',{roof:'dome',noPad:true});}
  else if(lm==='church'){makeBuilding(x0+22,z0+22,14,28,16,8,'down',{roof:'gable',noPlinth:true});makeBuilding(x0+22,z0+4.5,7,7,34,8,'down',{roof:'spire',spireH:16,noPlinth:true});}
  for(const [tx,tz] of[[x0+4,z0+40],[x0+40,z0+40],[x0+40,z0+4]])treeSpots.push({x:tx,z:tz});
  if(lm!=='civic'&&lm!=='church')for(let li=0;li<2;li++)for(let lj=0;lj<2;lj++){if(li===0&&lj===0)continue;const lcx=x0+2+li*21+9.5,lcz=z0+2+lj*21+9.5;tower(lcx,lcz,rand(15.5,18.5),rand(15.5,18.5),rand(55,110),'down',pick(['box','setback','podium']));}
  continue;}
 if(zone==='down'){for(let li=0;li<2;li++)for(let lj=0;lj<2;lj++){const lcx=x0+2+li*21+9.5,lcz=z0+2+lj*21+9.5;
   if(site&&li===0&&lj===0){buildSite(lcx,lcz,17,true);continue;}
   const w=rand(15.5,19),d=rand(15.5,19),H=rand(55,95)+Math.pow(Math.random(),1.2)*120*Math.max(0.3,1-dist*1.2),r=Math.random();
   tower(lcx+rand(-(19-w)/2,(19-w)/2),lcz+rand(-(19-d)/2,(19-d)/2),w,d,H,zone,r<0.32?'setback':r<0.52?'podium':r<0.66?'cyl':'box');}}
 else if(zone==='out'){for(let li=0;li<2;li++)for(let lj=0;lj<2;lj++){const lcx=x0+2+li*21+9.5,lcz=z0+2+lj*21+9.5;
   if(Math.random()<0.08){treeSpots.push({x:lcx+rand(-4,4),z:lcz+rand(-4,4)},{x:lcx+rand(-4,4),z:lcz+rand(-4,4)});continue;}
   if(Math.random()<0.5){for(const s of[-1,1]){const hw=rand(7.5,8.6),hd=rand(9,12),hh=rand(6,10);makeBuilding(lcx+s*4.6,lcz+rand(-2,2),hw,hd,hh,pick([5,6,7,8]),zone,{roof:'gable',noPlinth:true});treeSpots.push({x:lcx+s*4.6+rand(-2,2),z:lcz+(Math.random()<.5?-1:1)*7.6});}continue;}
   const w=rand(13,18.5),d=rand(13,18.5),h=rand(9,20)+Math.pow(Math.random(),2)*16;
   makeBuilding(lcx+rand(-(19-w)/2,(19-w)/2),lcz+rand(-(19-d)/2,(19-d)/2),w,d,h,pick([5,6,5,6,7,8,3]),zone,{roof:h<18&&Math.random()<0.4?'gable':null,bill:Math.random()<0.15});}}
 else{const L=40/3;for(let li=0;li<3;li++)for(let lj=0;lj<3;lj++){const lcx=x0+2+L*(li+0.5),lcz=z0+2+L*(lj+0.5);
   if(li===1&&lj===1){if(Math.random()<0.7)treeSpots.push({x:lcx+rand(-2,2),z:lcz+rand(-2,2)});continue;}
   if(site&&li===0&&lj===0){buildSite(lcx,lcz,12,false);continue;}
   const w=rand(10.4,12.9),d=rand(10.4,12.9),h=rand(16,34)+Math.pow(Math.random(),2)*45,si=pick([3,4,5,6,7,8,0]),r=Math.random(),px=lcx+rand(-(L-w)/2,(L-w)/2),pz=lcz+rand(-(L-d)/2,(L-d)/2);
   if(r<0.12&&h>32){const a=makeBuilding(px,pz,w,d,h*0.6,si,zone,{top:false});makeBuilding(px,pz,w*0.72,d*0.72,h*0.4,si,zone,{y0:h*0.6,parent:a});}
   else if(r<0.18)makeBuilding(px,pz,Math.min(w,d),Math.min(w,d),h,randi(0,2),zone,{cyl:true,roof:pick(['crown',null])});
   else if(r<0.28&&(si>=5))makeBuilding(px,pz,w,d,Math.min(h,26),si,zone,{roof:pick(['gable','pyramid'])});
   else if(r<0.32&&si>=7)makeBuilding(px,pz,w,d,Math.min(h,24),si,zone,{roof:'dome',noPad:true});
   else makeBuilding(px,pz,w,d,h,si,zone,{bill:Math.random()<0.2});}}}

/* street furniture */
const benchGeo=mergeBoxes([{w:1.8,h:0.08,d:0.45,x:0,y:0.45,z:0},{w:1.8,h:0.45,d:0.06,x:0,y:0.72,z:-0.2},{w:0.08,h:0.45,d:0.4,x:-0.8,y:0.22,z:0},{w:0.08,h:0.45,d:0.4,x:0.8,y:0.22,z:0}]);
const stopGeo=mergeBoxes([{w:3.6,h:0.12,d:1.5,x:0,y:2.5,z:0},{w:3.6,h:2.2,d:0.06,x:0,y:1.4,z:-0.68},{w:0.1,h:2.5,d:0.1,x:-1.7,y:1.25,z:-0.6},{w:0.1,h:2.5,d:0.1,x:1.7,y:1.25,z:-0.6},{w:2.4,h:0.08,d:0.4,x:0,y:0.48,z:-0.4},{w:0.06,h:1.4,d:1.2,x:1.75,y:1.5,z:-0.05}]);
{const F={bench:[],bin:[],hyd:[],stop:[],manh:[],tl:[]};
 for(let bi=0;bi<N;bi++)for(let bj=0;bj<N;bj++){if(bj===RJ)continue;const x0=-HALF+ROAD/2+bi*PITCH,z0=-HALF+ROAD/2+bj*PITCH,plaza=bi===CI&&bj===CI;
  const P=(side,t,ins)=>side===0?[x0+BLOCK/2+t,z0+ins,Math.PI]:side===1?[x0+BLOCK-ins,z0+BLOCK/2+t,Math.PI/2]:side===2?[x0+BLOCK/2+t,z0+BLOCK-ins,0]:[x0+ins,z0+BLOCK/2+t,-Math.PI/2];
  for(let sd=0;sd<4;sd++){if(!plaza)for(const t of[-17,-5.5,5.5,17])if(Math.random()<0.8){const p=P(sd,t,0.95);treeSpots.push({x:p[0],z:p[1],street:true});}
   if(Math.random()<0.4)F.bench.push(P(sd,rand(-9,9),0.7));const nb=randi(1,2);for(let k=0;k<nb;k++)F.bin.push(P(sd,rand(-19,19),0.55));if(Math.random()<0.35)F.hyd.push(P(sd,rand(-19,19),0.5));if(Math.random()<0.12)F.stop.push(P(sd,rand(-7,7),1.1));}}
 for(let k=0;k<320;k++){const i=randi(0,N),c=-HALF+i*PITCH+pick([-2.2,2.2]),a=rand(-HALF,HALF);F.manh.push(Math.random()<.5?[a,c]:[c,a]);}
 for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){const cx=-HALF+i*PITCH,cz=-HALF+j*PITCH;for(const sx of[-1,1])for(const sz of[-1,1])F.tl.push([cx+sx*7.9,cz+sz*7.9,sx*sz>0?0:1,sx,sz]);}
 const inst=(geo,mat,list,fn,shadow)=>{const im=new THREE.InstancedMesh(geo,mat,Math.max(1,list.length));list.forEach((q,i)=>{fn(q);dm.updateMatrix();im.setMatrixAt(i,dm.matrix);});if(!list.length){dm.scale.set(0,0,0);dm.updateMatrix();im.setMatrixAt(0,dm.matrix);}im.castShadow=!!shadow;im.receiveShadow=true;scene.add(im);return im;};
 const std=q=>{dm.position.set(q[0],0.06,q[1]);dm.rotation.set(0,q[2],0);dm.scale.set(1,1,1);};
 inst(benchGeo,M(0x6b4a33,0.8),F.bench,std,true);inst(new THREE.CylinderGeometry(0.28,0.24,0.95,12).translate(0,0.47,0),M(0x2f4a3a,0.6,{metalness:0.4}),F.bin,std,true);
 inst(new THREE.CylinderGeometry(0.13,0.16,0.75,10).translate(0,0.37,0),M(0xb8322a,0.5,{metalness:0.3}),F.hyd,std,false);
 inst(stopGeo,M(0x3a4048,0.4,{metalness:0.6}),F.stop,std,true);
 inst(new THREE.CylinderGeometry(0.45,0.45,0.02,16),M(0x2a2b2d,0.6,{metalness:0.6}),F.manh,q=>{dm.position.set(q[0],0.035,q[1]);dm.rotation.set(0,0,0);dm.scale.set(1,1,1);},false);
 const tlPos=q=>{dm.position.set(q[0],2.9,q[1]);dm.rotation.set(0,0,0);dm.scale.set(1,1,1);};
 inst(new THREE.CylinderGeometry(0.1,0.13,5.8,8),M(0x2e3134,0.45,{metalness:0.7}),F.tl,tlPos,true);
 inst(boxGeo,M(0x2e3134,0.45,{metalness:0.7}),F.tl,q=>{const ax=q[2];dm.position.set(q[0]-(ax===0?q[3]*2.4:0),5.6,q[1]-(ax===1?q[4]*2.4:0));dm.rotation.set(0,0,0);dm.scale.set(ax===0?4.8:0.12,0.12,ax===1?4.8:0.12);},true);
 const housePos=q=>{const ax=q[2];dm.position.set(q[0]-(ax===0?q[3]*4.4:0),5.1,q[1]-(ax===1?q[4]*4.4:0));dm.rotation.set(0,0,0);dm.scale.set(0.38,1.05,0.38);};
 inst(boxGeo,M(0x1b1d22,0.5),F.tl,housePos,true);
 const lampI=new THREE.InstancedMesh(new THREE.SphereGeometry(0.11,8,6),new THREE.MeshBasicMaterial({color:0xffffff}),F.tl.length*2);const lc2=new THREE.Color();
 F.tl.forEach((q,i)=>{const ax=q[2],x=q[0]-(ax===0?q[3]*4.4:0),z=q[1]-(ax===1?q[4]*4.4:0),red=(i+ax)%2===0;for(let k=0;k<2;k++){const fx=ax===1?0.2*(k?1:-1):0,fz=ax===0?0.2*(k?1:-1):0;dm.position.set(x+fx,5.35-k*0.3,z+fz);dm.rotation.set(0,0,0);dm.scale.set(1,1,1);dm.updateMatrix();lampI.setMatrixAt(i*2+k,dm.matrix);lampI.setColorAt(i*2+k,lc2.set(k===0?(red?0xff3020:0x3a1010):(red?0x103a18:0x30ff60)).convertSRGBToLinear());}});scene.add(lampI);}
/* plaza fountain */
{const basin=new THREE.Mesh(new THREE.CylinderGeometry(5,5.4,0.7,32),M(0xb9b4aa,0.8));basin.position.set(0,0.35,0);basin.receiveShadow=true;basin.castShadow=true;scene.add(basin);
 const water=new THREE.Mesh(new THREE.CylinderGeometry(4.6,4.6,0.1,32),M(0x3f7fb8,0.15,{metalness:0.2}));water.position.set(0,0.66,0);scene.add(water);
 const col=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.7,2.4,16),M(0xb9b4aa,0.8));col.position.set(0,1.5,0);col.castShadow=true;scene.add(col);}
/* trees */
{const n=treeSpots.length;const trunkI=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13,0.22,3,7),M(0x4e3a2b,0.9),n);const leafI=new THREE.InstancedMesh(canopyGeo,leafMat,n*3);const tc=new THREE.Color();
 treeSpots.forEach((p,i)=>{const s=rand(0.85,1.35);dm.position.set(p.x,1.5*s,p.z);dm.scale.set(s,s,s);dm.rotation.set(0,rand(0,6),0);dm.updateMatrix();trunkI.setMatrixAt(i,dm.matrix);const base=pick([0x3f6b30,0x4d7a3a,0x5a7f35,0x3a5f2c]);
  for(let k=0;k<3;k++){dm.position.set(p.x+rand(-0.9,0.9)*s,(3.4+k*0.7+rand(-0.3,0.3))*s,p.z+rand(-0.9,0.9)*s);const q=s*rand(0.75,1.1)*(k===2?0.8:1);dm.scale.set(q,q*rand(0.85,1.1),q);dm.rotation.set(rand(0,3),rand(0,3),0);dm.updateMatrix();leafI.setMatrixAt(i*3+k,dm.matrix);leafI.setColorAt(i*3+k,tc.set(base).offsetHSL(rand(-0.02,0.02),0,rand(-0.05,0.05)).convertSRGBToLinear());}});
 trunkI.castShadow=leafI.castShadow=true;leafI.receiveShadow=true;scene.add(trunkI,leafI);}
const LAMP_MAT=new THREE.MeshStandardMaterial({color:lin(0xf4efe2),emissive:lin(0xffd9a0),emissiveIntensity:0.35,roughness:0.3});
function radialMask(inner){return cv(64,64,(g,w,h)=>{g.fillStyle='#000';g.fillRect(0,0,w,h);const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'#fff');gr.addColorStop(inner,'#8a8a8a');gr.addColorStop(1,'#000');g.fillStyle=gr;g.fillRect(0,0,w,h);},true);}
const POOL_MAT=new THREE.MeshBasicMaterial({color:lin(0xffc27a),alphaMap:radialMask(0.4),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});let POOL_I=null;
/* crosswalks, curbs, street lamps */
{const cw=[];for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){const cx=-HALF+i*PITCH,cz=-HALF+j*PITCH;for(const sd of[-1,1]){for(let k=-5.4;k<=5.5;k+=1.2){cw.push([cx+sd*9.2,cz+k,0]);cw.push([cx+k,cz+sd*9.2,1]);}}}
 const cwI=new THREE.InstancedMesh(new THREE.BoxGeometry(2.6,0.03,0.6),M(0xe6e3da,0.7),cw.length);cw.forEach((q,i)=>{dm.position.set(q[0],0.045,q[1]);dm.rotation.set(0,q[2]?Math.PI/2:0,0);dm.scale.set(1,1,1);dm.updateMatrix();cwI.setMatrixAt(i,dm.matrix);});cwI.receiveShadow=true;scene.add(cwI);
 const curbs=[],lamps=[];for(let bi=0;bi<N;bi++)for(let bj=0;bj<N;bj++){if(bj===RJ)continue;const x0=-HALF+ROAD/2+bi*PITCH,z0=-HALF+ROAD/2+bj*PITCH,cx=x0+BLOCK/2,cz=z0+BLOCK/2;curbs.push([cx,z0+0.15,BLOCK,0.3],[cx,z0+BLOCK-0.15,BLOCK,0.3],[x0+0.15,cz,0.3,BLOCK],[x0+BLOCK-0.15,cz,0.3,BLOCK]);
  for(const t of[-11,11]){lamps.push([cx+t,z0+0.9,0],[cx+t,z0+BLOCK-0.9,Math.PI],[x0+0.9,cz+t,Math.PI/2],[x0+BLOCK-0.9,cz+t,-Math.PI/2]);}}
 const curbI=new THREE.InstancedMesh(boxGeo,M(0x9d9a93,0.85),curbs.length);curbs.forEach((c,i)=>{dm.position.set(c[0],0.08,c[1]);dm.rotation.set(0,0,0);dm.scale.set(c[2],0.16,c[3]);dm.updateMatrix();curbI.setMatrixAt(i,dm.matrix);});curbI.receiveShadow=true;scene.add(curbI);
 const poleI=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07,0.11,7,8),M(0x2e3134,0.45,{metalness:0.7}),lamps.length),armI=new THREE.InstancedMesh(boxGeo,M(0x2e3134,0.45,{metalness:0.7}),lamps.length),headI=new THREE.InstancedMesh(boxGeo,LAMP_MAT,lamps.length);
 lamps.forEach((l,i)=>{const dx=Math.sin(l[2]),dz=Math.cos(l[2]);dm.rotation.set(0,l[2],0);dm.position.set(l[0],3.5,l[1]);dm.scale.set(1,1,1);dm.updateMatrix();poleI.setMatrixAt(i,dm.matrix);dm.position.set(l[0]-dx*0.9,6.95,l[1]-dz*0.9);dm.scale.set(0.1,0.1,1.8);dm.updateMatrix();armI.setMatrixAt(i,dm.matrix);dm.position.set(l[0]-dx*1.7,6.85,l[1]-dz*1.7);dm.scale.set(0.35,0.14,0.7);dm.updateMatrix();headI.setMatrixAt(i,dm.matrix);});
 poleI.castShadow=armI.castShadow=true;scene.add(poleI,armI,headI);
 POOL_I=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),POOL_MAT,lamps.length);lamps.forEach((l,i)=>{const dx=Math.sin(l[2]),dz=Math.cos(l[2]);dm.rotation.set(0,0,0);dm.position.set(l[0]-dx*1.7,0.1,l[1]-dz*1.7);dm.scale.set(11,1,11);dm.updateMatrix();POOL_I.setMatrixAt(i,dm.matrix);});POOL_I.frustumCulled=false;POOL_I.renderOrder=3;scene.add(POOL_I);}
/* road markings */
{const dashes=[];for(let i=0;i<=N;i++){const c=-HALF+i*PITCH;for(let s=-HALF;s<HALF;s+=6){const m=(s+HALF)%PITCH;if(m<9||m>PITCH-9)continue;dashes.push([s+1.5,c,0],[c,s+1.5,1]);}}
 const dashI=new THREE.InstancedMesh(new THREE.BoxGeometry(3,0.03,0.25),M(0xe9e6dc,0.6),dashes.length);
 dashes.forEach((q,i)=>{dm.position.set(q[0],0.04,q[1]);dm.rotation.set(0,q[2]?Math.PI/2:0,0);dm.scale.set(1,1,1);dm.updateMatrix();dashI.setMatrixAt(i,dm.matrix);});dashI.receiveShadow=true;scene.add(dashI);}
/* ---------- vehicles v3: nine body types with their own silhouettes, glass, trim and details ---------- */
function carShape(cmds,arches,by){const s=new THREE.Shape();s.moveTo(cmds[0][1],cmds[0][2]);for(let i=1;i<cmds.length;i++){const c=cmds[i];if(c[0]==='L')s.lineTo(c[1],c[2]);else s.quadraticCurveTo(c[1],c[2],c[3],c[4]);}
 if(arches){for(const[cx,r]of arches){s.lineTo(cx+r,by);s.absarc(cx,by-0.03,r,0,Math.PI,false);}s.lineTo(cmds[0][1],by);}return s;}
function carBody(cmds,arches,by,W){const b=0.07,d=W-2*b,g=new THREE.ExtrudeGeometry(carShape(cmds,arches,by),{depth:d,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:3,curveSegments:12});g.translate(0,0,-d/2);g.rotateY(-Math.PI/2);g.computeVertexNormals();return g;}
function carGlass(cmds,W){const g=new THREE.ExtrudeGeometry(carShape(cmds,null,0),{depth:W,bevelEnabled:true,bevelThickness:0.01,bevelSize:0.085,bevelSegments:1,curveSegments:10});g.translate(0,0,-W/2);g.rotateY(-Math.PI/2);g.computeVertexNormals();return g;}
const rbAt=(w,h,d,r,x,y,z)=>roundedBox(w,h,d,r).translate(x,y,z);
const L_=(x,y)=>['L',x,y],Q_=(a,b,x,y)=>['Q',a,b,x,y];
const SEDAN={len:4.6,W:1.84,by:0.36,arches:[[1.35,0.43],[-1.35,0.43]],cmds:[['M',-2.22,0.36],L_(-2.26,0.74),Q_(-2.24,0.93,-2.02,0.96),L_(-1.38,1),Q_(-1.05,1.3,-0.75,1.42),Q_(-0.2,1.47,0.36,1.44),Q_(0.75,1.25,1.06,1.02),Q_(1.6,0.96,2.02,0.9),Q_(2.26,0.86,2.27,0.72),L_(2.22,0.36)],
 glass:[['M',-1.42,0.98],Q_(-1.08,1.3,-0.76,1.435),Q_(-0.2,1.49,0.38,1.46),Q_(0.78,1.26,1.1,0.99),L_(-1.42,0.98)],wz:[1.35,-1.35],wr:0.34,track:0.82,lf:[0.76,2.3,1.45,0.12],lb:[0.84,-2.3,1.5,0.1],mir:[1.0,1.05,0.98,1],plateY:0.6,
 trim:[[1.86,0.24,0.2,0.08,0,0.46,2.3],[1.86,0.24,0.2,0.08,0,0.46,-2.3],[0.8,0.16,0.06,0.03,0,0.66,2.26]]};
const CT={
 sedan:Object.assign({w:30,cols:'std'},SEDAN),
 taxi:Object.assign({w:8,cols:[0xf2c21a],sign:true},SEDAN),
 hatch:{w:18,cols:'std',len:4.0,W:1.78,by:0.36,arches:[[1.28,0.41],[-1.28,0.41]],cmds:[['M',-1.97,0.36],L_(-2,0.8),L_(-1.96,1.28),Q_(-1.88,1.46,-1.62,1.47),L_(0.2,1.46),Q_(0.6,1.25,0.95,1),Q_(1.45,0.94,1.85,0.88),Q_(2.02,0.84,2.02,0.7),L_(1.98,0.36)],
  glass:[['M',-1.9,1],L_(-1.86,1.3),Q_(-1.76,1.43,-1.58,1.44),L_(0.18,1.43),Q_(0.56,1.23,0.9,0.99),L_(-1.9,1)],wz:[1.28,-1.28],wr:0.32,track:0.79,lf:[0.74,2.0,1.3,0.12],lb:[1.0,-1.99,1.3,0.12],mir:[0.98,1.0,0.85,1],plateY:0.58,
  trim:[[1.8,0.24,0.2,0.08,0,0.44,2.0],[1.8,0.24,0.2,0.08,0,0.44,-2.0],[0.7,0.15,0.06,0.03,0,0.64,1.97]]},
 coupe:{w:6,cols:[0xc62a34,0x1f4fa8,0xf2c21a,0xd0661f,0x1b1d22,0xe9e9e6,0x2f7a3a],len:4.4,W:1.88,by:0.34,arches:[[1.35,0.39],[-1.35,0.39]],cmds:[['M',-2.15,0.34],L_(-2.2,0.75),Q_(-2.18,0.92,-1.95,0.95),L_(-1.5,0.98),Q_(-0.9,1.25,-0.45,1.29),Q_(0.05,1.31,0.35,1.26),Q_(0.75,1.05,1.05,0.92),Q_(1.7,0.84,2.1,0.74),Q_(2.22,0.7,2.22,0.6),L_(2.18,0.34)],
  glass:[['M',-1.45,0.97],Q_(-0.9,1.21,-0.45,1.245),Q_(0.05,1.265,0.33,1.22),Q_(0.72,1.03,1.02,0.9),L_(-1.45,0.97)],wz:[1.35,-1.35],wr:0.34,track:0.84,lf:[0.66,2.22,1.5,0.08],lb:[0.85,-2.22,1.6,0.08],mir:[1.02,0.98,0.85,1],plateY:0.55,
  trim:[[1.9,0.22,0.2,0.08,0,0.42,2.2],[1.9,0.22,0.2,0.08,0,0.42,-2.2],[1.6,0.05,0.28,0.02,0,1.12,-2.0],[0.06,0.15,0.06,0.02,0.6,1.04,-2.0],[0.06,0.15,0.06,0.02,-0.6,1.04,-2.0]]},
 suv:{w:15,cols:'std',len:4.7,W:1.96,by:0.44,arches:[[1.42,0.49],[-1.42,0.49]],cmds:[['M',-2.3,0.44],L_(-2.34,1.0),L_(-2.3,1.58),Q_(-2.26,1.74,-2.08,1.76),L_(0.7,1.78),Q_(1.05,1.5,1.36,1.16),Q_(1.85,1.12,2.2,1.06),Q_(2.36,1.02,2.36,0.86),L_(2.32,0.44)],
  glass:[['M',-2.22,1.16],L_(-2.2,1.66),L_(0.68,1.69),Q_(1.0,1.45,1.34,1.15),L_(-2.22,1.16)],wz:[1.42,-1.42],wr:0.39,track:0.86,lf:[0.95,2.36,1.5,0.12],lb:[1.15,-2.35,1.5,0.12],mir:[1.06,1.22,1.25,1],plateY:0.72,
  trim:[[1.98,0.28,0.22,0.09,0,0.55,2.36],[1.98,0.28,0.22,0.09,0,0.55,-2.36],[1.0,0.22,0.06,0.03,0,0.85,2.33],[0.06,0.06,2.4,0.02,0.8,1.85,-0.6],[0.06,0.06,2.4,0.02,-0.8,1.85,-0.6]]},
 van:{w:8,cols:[0xe9e9e6,0xe9e9e6,0xb8bcc0,0x1f3a5a,0x55585c],len:5.0,W:2.0,by:0.42,arches:[[1.55,0.45],[-1.6,0.45]],cmds:[['M',-2.48,0.42],L_(-2.5,1.9),Q_(-2.48,2.12,-2.3,2.14),L_(1.2,2.14),Q_(1.55,2.1,1.75,1.7),Q_(1.95,1.2,2.25,1.1),Q_(2.5,1.05,2.5,0.85),L_(2.46,0.42)],
  glass:[['M',-2.35,1.42],L_(-2.35,1.9),L_(1.15,1.98),Q_(1.45,1.95,1.62,1.6),Q_(1.75,1.32,1.85,1.22),L_(-2.35,1.42)],wz:[1.55,-1.6],wr:0.37,track:0.9,lf:[1.0,2.5,1.5,0.12],lb:[1.2,-2.51,1.6,0.12],mir:[1.1,1.55,1.5,1.2],plateY:0.66,
  trim:[[2.0,0.26,0.2,0.09,0,0.5,2.5],[2.0,0.26,0.2,0.09,0,0.5,-2.5],[1.1,0.25,0.06,0.03,0,0.85,2.47]]},
 pickup:{w:7,cols:'std',len:5.4,W:2.0,by:0.5,arches:[[1.75,0.5],[-1.9,0.5]],cmds:[['M',-2.68,0.5],L_(-2.7,1.18),L_(-0.74,1.18),L_(-0.72,1.8),Q_(-0.66,1.86,-0.45,1.86),L_(0.45,1.85),Q_(0.9,1.5,1.2,1.2),Q_(1.9,1.12,2.55,1.05),Q_(2.73,1.0,2.73,0.8),L_(2.67,0.5)],
  glass:[['M',-0.64,1.22],L_(-0.64,1.78),L_(0.42,1.78),Q_(0.82,1.48,1.12,1.2),L_(-0.64,1.22)],wz:[1.75,-1.9],wr:0.42,track:0.88,lf:[1.0,2.72,1.5,0.14],lb:[1.0,-2.71,1.7,0.1],mir:[1.1,1.5,0.6,1.2],plateY:0.78,
  trim:[[2.02,0.3,0.22,0.1,0,0.62,2.72],[2.02,0.3,0.22,0.1,0,0.62,-2.72],[1.9,0.04,1.95,0.015,0,1.21,-1.72],[1.2,0.3,0.06,0.03,0,0.9,2.7]]},
 truck:{w:5,cols:[0xe9e9e6,0xc62a34,0x1f4fa8,0xe9e9e6,0x2f7a3a],len:6.6,W:2.3,by:0.55,arches:[[2.3,0.5],[-2.2,0.5]],cmds:[['M',-3.28,0.55],L_(-3.3,0.95),L_(0.9,0.95),L_(0.92,2.15),Q_(1.0,2.27,1.2,2.27),L_(1.9,2.26),Q_(2.22,2.15,2.38,1.5),L_(2.45,1.36),Q_(3.22,1.3,3.3,1.0),L_(3.26,0.55)],
  glass:[['M',1.02,1.47],L_(1.02,2.12),L_(1.85,2.15),Q_(2.12,2.05,2.3,1.47),L_(1.02,1.47)],wz:[2.3,-2.2],wr:0.5,track:1.0,lf:[1.1,3.28,1.8,0.14],lb:[0.9,-3.31,2.0,0.12],mir:[1.3,1.9,2.0,1.5],plateY:0.62,cargo:true,
  trim:[[2.3,0.35,0.22,0.1,0,0.6,3.28],[2.3,0.3,0.22,0.1,0,0.6,-3.3],[1.3,0.35,0.06,0.03,0,1.05,3.26]]},
 bus:{w:3,cols:[0x1f5f8b,0xc62a34,0x2f7a3a,0xe8b923],moveOnly:true,len:11,W:2.5,by:0.45,arches:[[3.6,0.55],[-3.0,0.55]],cmds:[['M',-5.48,0.45],L_(-5.5,2.85),Q_(-5.48,3.06,-5.28,3.06),L_(5.2,3.06),Q_(5.46,3.02,5.5,2.72),L_(5.52,0.45)],
  glass:[['M',-5.32,1.6],L_(-5.32,2.72),L_(5.38,2.72),L_(5.45,1.15),L_(-5.32,1.6)],wz:[3.6,-3.0],wr:0.52,track:1.08,lf:[0.75,5.52,2.0,0.14],lb:[1.0,-5.52,2.0,0.14],mir:[1.35,2.4,5.3,1.6],plateY:0.62,
  trim:[[2.5,0.35,0.24,0.1,0,0.55,5.5],[2.5,0.35,0.24,0.1,0,0.55,-5.5]]}};
const STD_COLS=[0xb8bcc0,0xb8bcc0,0x1b1d22,0x1b1d22,0xe9e9e6,0xe9e9e6,0x55585c,0x55585c,0x7a1f24,0x2a4a7a,0x1f3a5a,0x3d5a3a,0xd8d4cc,0x8a2b1d,0x6b4a33];
const CT_KEYS=Object.keys(CT),CT_W=CT_KEYS.reduce((a,k)=>a+CT[k].w,0);
function pickType(moving){for(let t=0;t<5;t++){let r=Math.random()*CT_W;for(const k of CT_KEYS){r-=CT[k].w;if(r<=0){if(CT[k].moveOnly&&!moving)break;return k;}}}return 'sedan';}
/* vehicles: traffic + parked, can be thrown */
const cars=[],LANE_LEN=2*HALF+20;
{const lanes=[];for(let i=0;i<=N;i++){const c=-HALF+i*PITCH;lanes.push({ax:0,c:c+2.2,dir:1},{ax:0,c:c-2.2,dir:-1},{ax:1,c:c-2.2,dir:1},{ax:1,c:c+2.2,dir:-1});}
 const mk=(o,moving)=>{const type=pickType(moving),T=CT[type];return Object.assign({type,roll:0,pos:new V3(),ry:0,rx:0,rz:0,vel:new V3(),av:new V3(),state:0,respawn:0,color:T.cols==='std'?pick(STD_COLS):pick(T.cols),smokeT:0},o);};
 lanes.forEach(l=>{const sp=rand(9,15),n=randi(2,3),off=rand(0,LANE_LEN);for(let k=0;k<n;k++)cars.push(mk({moving:true,lane:l,along:((off+k*LANE_LEN/n)%LANE_LEN)-LANE_LEN/2,speed:sp},true));});
 for(let k=0;k<400&&cars.length<330;k++){const i=randi(0,N),c=-HALF+i*PITCH,along=rand(-HALF+10,HALF-10),m=(along+HALF)%PITCH;if(m<12||m>PITCH-12)continue;const side=Math.random()<.5?-1:1;const car=Math.random()<.5?mk({moving:false,home:new V3(along,0,c+side*4.8),homeRy:Math.PI/2},false):mk({moving:false,home:new V3(c+side*4.8,0,along),homeRy:0},false);car.pos.copy(car.home);car.ry=car.homeRy;cars.push(car);}}
const PAINT=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:0.28,metalness:0.55,clearcoat:1,clearcoatRoughness:0.08}),CGLASS=M(0x18212b,0.04,{metalness:0.75}),CTRIM=M(0x24262a,0.55,{metalness:0.15});
const carInst=[];
for(const k of CT_KEYS){const T=CT[k];const list=cars.filter(c=>c.type===k);const n=Math.max(1,list.length);
 T.body=new THREE.InstancedMesh(carBody(T.cmds,T.arches,T.by,T.W),PAINT,n);T.glassI=new THREE.InstancedMesh(carGlass(T.glass,T.W),CGLASS,n);T.trimI=new THREE.InstancedMesh(mergeGeos(T.trim.map(q=>rbAt(...q))),CTRIM,n);
 const cc=new THREE.Color();list.forEach((c,i)=>{c.ti=i;T.body.setColorAt(i,cc.set(c.color).convertSRGBToLinear());});
 if(!list.length){for(const m of[T.body,T.glassI,T.trimI])m.setMatrixAt(0,new THREE.Matrix4().makeScale(0,0,0));}
 carInst.push(T.body,T.glassI,T.trimI);}
const taxiList=cars.filter(c=>CT[c.type].sign),truckList=cars.filter(c=>CT[c.type].cargo);
const taxiSignI=new THREE.InstancedMesh(mergeGeos([rbAt(0.62,0.18,0.26,0.05,0,1.56,-0.25)]),new THREE.MeshStandardMaterial({color:lin(0xfff6d8),emissive:lin(0xffe9a0),emissiveIntensity:0.6,roughness:0.4}),Math.max(1,taxiList.length));taxiList.forEach((c,i)=>c.signI=i);
const cargoI=new THREE.InstancedMesh(rbAt(2.36,2.35,4.2,0.05,0,2.13,-1.1),M(0xffffff,0.6),Math.max(1,truckList.length));{const cc=new THREE.Color();truckList.forEach((c,i)=>{c.cargoI=i;cargoI.setColorAt(i,cc.set(pick([0xf2f0ea,0xf2f0ea,0xdcdcdc,0xc9a227,0x1f4fa8])).convertSRGBToLinear());});}
const carWheelI=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34,0.34,0.24,20),M(0x141414,0.85),cars.length*4),carRimI=new THREE.InstancedMesh(mergeGeos([new THREE.CylinderGeometry(0.21,0.21,0.26,16),...[0,1,2,3,4].map(k=>new THREE.BoxGeometry(0.05,0.265,0.36).rotateY(k*Math.PI/5))]),M(0xc9ccd2,0.25,{metalness:0.9}),cars.length*4),
 carLightI=new THREE.InstancedMesh(boxGeo,new THREE.MeshBasicMaterial({color:0xffffff}),cars.length*2),carMirI=new THREE.InstancedMesh(roundedBox(0.2,0.13,0.12,0.04),CTRIM,cars.length*2),carPlateI=new THREE.InstancedMesh(boxGeo,M(0xf2f2ee,0.4),cars.length*2);
{const cc=new THREE.Color();cars.forEach((c,i)=>{carLightI.setColorAt(i*2,cc.set(0xfff4d8).convertSRGBToLinear());carLightI.setColorAt(i*2+1,cc.set(0xff2a20).convertSRGBToLinear());});}
[...carInst,taxiSignI,cargoI,carWheelI,carRimI,carLightI,carMirI,carPlateI].forEach(m=>{m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.castShadow=m!==carLightI;m.receiveShadow=true;m.frustumCulled=false;scene.add(m);});
const carRoot=new THREE.Object3D(),cWh=[0,1,2,3].map(()=>new THREE.Object3D()),cLF=new THREE.Object3D(),cLB=new THREE.Object3D(),cMir=[0,1].map(()=>new THREE.Object3D()),cPl=[0,1].map(()=>new THREE.Object3D());
cWh.forEach(w=>{w.rotation.z=Math.PI/2;});carRoot.add(...cWh,cLF,cLB,...cMir,...cPl);const ZM=new THREE.Matrix4().makeScale(0,0,0);
function carLayout(c){const T=CT[c.type];cWh.forEach((w,k)=>{w.position.set(k<2?-T.track:T.track,T.wr,k%2?T.wz[0]:T.wz[1]);w.scale.setScalar(T.wr/0.34);});
 cLF.position.set(0,T.lf[0],T.lf[1]);cLF.scale.set(T.lf[2],T.lf[3],0.04);cLB.position.set(0,T.lb[0],T.lb[1]);cLB.scale.set(T.lb[2],T.lb[3],0.04);
 for(const k of[0,1]){cMir[k].position.set((k?1:-1)*T.mir[0],T.mir[1],T.mir[2]);cMir[k].scale.setScalar(T.mir[3]);cPl[k].position.set(0,T.plateY,(k?-1:1)*(T.len/2+0.06));cPl[k].scale.set(0.52,0.12,0.02);}}
function hideCar(c,i){const T=CT[c.type];T.body.setMatrixAt(c.ti,ZM);T.glassI.setMatrixAt(c.ti,ZM);T.trimI.setMatrixAt(c.ti,ZM);if(c.signI!=null)taxiSignI.setMatrixAt(c.signI,ZM);if(c.cargoI!=null)cargoI.setMatrixAt(c.cargoI,ZM);for(let k=0;k<4;k++){carWheelI.setMatrixAt(i*4+k,ZM);carRimI.setMatrixAt(i*4+k,ZM);}for(let k=0;k<2;k++){carLightI.setMatrixAt(i*2+k,ZM);carMirI.setMatrixAt(i*2+k,ZM);carPlateI.setMatrixAt(i*2+k,ZM);}}
function drawCar(c,i){const T=CT[c.type];carLayout(c);for(const w of cWh)w.rotation.x=c.roll;carRoot.position.copy(c.pos);carRoot.rotation.set(c.rx,c.ry,c.rz);carRoot.updateMatrixWorld(true);const mw=carRoot.matrixWorld;
 T.body.setMatrixAt(c.ti,mw);T.glassI.setMatrixAt(c.ti,mw);T.trimI.setMatrixAt(c.ti,mw);if(c.signI!=null)taxiSignI.setMatrixAt(c.signI,mw);if(c.cargoI!=null)cargoI.setMatrixAt(c.cargoI,mw);
 for(let k=0;k<4;k++){carWheelI.setMatrixAt(i*4+k,cWh[k].matrixWorld);carRimI.setMatrixAt(i*4+k,cWh[k].matrixWorld);}carLightI.setMatrixAt(i*2,cLF.matrixWorld);carLightI.setMatrixAt(i*2+1,cLB.matrixWorld);for(let k=0;k<2;k++){carMirI.setMatrixAt(i*2+k,cMir[k].matrixWorld);carPlateI.setMatrixAt(i*2+k,cPl[k].matrixWorld);}}
function carsNeedUpdate(){for(const m of[...carInst,taxiSignI,cargoI,carWheelI,carRimI,carLightI,carMirI,carPlateI])m.instanceMatrix.needsUpdate=true;}
function launchCar(c,v){if(ARENA||c.state!==0)return;c.state=1;c.vel.copy(v);c.av.set(rand(-4,4),rand(-3,3),rand(-4,4));c.pos.y=Math.max(c.pos.y,0.3);}
function destroyCar(c){if(ARENA||c.state===2)return;c.state=2;c.heat=0;c.respawn=time+rand(20,35);const pt=c.pos.clone();pt.y+=0.8;fireBurst(pt,26,9);dustBurst(pt,10,4,3,2,6,1.6,[0.25,0.25,0.26]);spawnDebris(pt,10,10,0.25,1.1,c.color);flashAt(pt,4);sfxAt('boom',pt,260,0.6);sfxAt('shatter',pt,160,0.8);addShakeAt(pt,0.25);panicAt(pt);
 for(const e of enemies){if(!e.dead&&e.pos.distanceTo(pt)<4+e.r)damageEnemy(e,30*ST.dmg,null);}}
let killBumpT=0;function bumpKills(n){if(VILLAIN_ACTING){VILLAIN_ACTING.kills+=n;return;}if(MIL_ACTING)return;prog.kills=(prog.kills||0)+n;const kv=document.getElementById('killsV');if(kv){kv.textContent=prog.kills.toLocaleString('tr-TR');kv.classList.add('bump');clearTimeout(killBumpT);killBumpT=setTimeout(()=>kv.classList.remove('bump'),140);}saveDirty=true;}
function knockPed(p,dir,force){if(ARENA||p.down>0||p.gone)return;bumpKills(1);p.down=7;p.kx=p.x;p.kz=p.z;p.ky=0.02;p.kv=new V3(dir.x*force,3.5+force*0.35,dir.z*force);p.spin=rand(-7,7);p.rot=0;p.panic=0;p.wait=0;}
function cityImpact(pt,r,force){if(typeof unitsImpact==='function')unitsImpact(pt,r,force);for(const p of peds){if(p.down>0)continue;const dx=p.x-pt.x,dz=p.z-pt.z,d=Math.hypot(dx,dz);if(d<r+1.5&&pt.y<6){knockPed(p,new V3(dx/(d||1),0,dz/(d||1)),3+force*0.45*(1-d/(r+1.5)));}}
 for(const c of cars){if(c.state!==0)continue;const dx=c.pos.x-pt.x,dz=c.pos.z-pt.z,d=Math.hypot(dx,dz);if(d<r+2&&pt.y<c.pos.y+r){const k=force*(1-d/(r+2))+6;launchCar(c,new V3(dx/(d||1)*k,k*0.6+4,dz/(d||1)*k));}}panicAt(pt);}
/* pedestrians */
const peds=[];for(let k=0;k<(IS_MOBILE?640:1800);k++)peds.push({wait:0,bi:randi(0,N-1),bj:(()=>{let j=randi(0,N-1);return j===RJ?j-1:j;})(),inset:rand(1.3,1.8),s:rand(0,170),dir:Math.random()<.5?1:-1,speed:rand(1.1,1.6),panic:0,ph:rand(0,6),x:0,z:0,ry:0});
function pedPlace(p){const x0=-HALF+ROAD/2+p.bi*PITCH,z0=-HALF+ROAD/2+p.bj*PITCH,S=BLOCK-2*p.inset,L4=4*S,s=((p.s%L4)+L4)%L4,side=Math.floor(s/S),t=s-side*S;let hx,hz;
 if(side===0){p.x=x0+p.inset+t;p.z=z0+p.inset;hx=1;hz=0;}else if(side===1){p.x=x0+BLOCK-p.inset;p.z=z0+p.inset+t;hx=0;hz=1;}else if(side===2){p.x=x0+BLOCK-p.inset-t;p.z=z0+BLOCK-p.inset;hx=-1;hz=0;}else{p.x=x0+p.inset;p.z=z0+BLOCK-p.inset-t;hx=0;hz=-1;}p.ry=Math.atan2(hx*p.dir,hz*p.dir);}
function panicAt(pt){for(const p of peds){const dx=p.x-pt.x,dz=p.z-pt.z;if(dx*dx+dz*dz<70*70){p.panic=rand(5,9);if(Math.sin(p.ry)*dx+Math.cos(p.ry)*dz<0)p.dir*=-1;}}}
/* pedestrians v3: anatomical bodies, clothing layers, hairstyles, accessories, natural gait */
const PN=peds.length;
const V2L=a=>a.map(q=>new THREE.Vector2(q[0],q[1]));
const SG=(r,w,h)=>new THREE.SphereGeometry(r||1,w||14,h||10);
const fabN=normalMapFrom(mkc(64,64,(g,w,h)=>{g.fillStyle='#c8c8c8';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=2){g.fillStyle=y%4?'#b4b4b4':'#d6d6d6';g.fillRect(0,y,w,1);}for(let x=0;x<w;x+=3){g.fillStyle='rgba(120,120,120,.35)';g.fillRect(x,0,1,h);}}),1.2);fabN.repeat.set(5,5);
const TM=[[0.001,0],[0.155,0.02],[0.16,0.12],[0.165,0.26],[0.19,0.4],[0.205,0.48],[0.2,0.54],[0.15,0.6],[0.06,0.64]],TF=[[0.001,-0.02],[0.165,0.0],[0.17,0.08],[0.135,0.24],[0.15,0.38],[0.158,0.46],[0.15,0.54],[0.11,0.6],[0.045,0.63]];
const delt=(x,r)=>[SG(r,12,10).translate(x,0.53,0),SG(r,12,10).translate(-x,0.53,0)];
const PG={
 torsoM:mergeGeos([new THREE.LatheGeometry(V2L(TM),20).scale(1,1,0.6),...delt(0.19,0.072),new THREE.CylinderGeometry(0.062,0.07,0.04,14).translate(0,0.63,0)]),
 torsoF:mergeGeos([new THREE.LatheGeometry(V2L(TF),20).scale(1,1,0.64),...delt(0.155,0.06),SG(1,12,10).scale(0.07,0.06,0.05).translate(0.062,0.4,0.075),SG(1,12,10).scale(0.07,0.06,0.05).translate(-0.062,0.4,0.075)]),
 dress:mergeGeos([new THREE.LatheGeometry(V2L([[0.001,-0.47],[0.28,-0.46],[0.235,-0.26],[0.19,-0.05],[0.17,0.08],...TF.slice(3)]),22).scale(1,1,0.72),...delt(0.155,0.06),SG(1,12,10).scale(0.07,0.06,0.05).translate(0.062,0.4,0.08),SG(1,12,10).scale(0.07,0.06,0.05).translate(-0.062,0.4,0.08)]),
 jacket:mergeGeos([new THREE.LatheGeometry(V2L([[0.168,-0.04],[0.175,0.12],[0.18,0.26],[0.205,0.4],[0.22,0.48],[0.215,0.55],[0.16,0.61],[0.08,0.65]]),20,0.38,Math.PI*2-0.76).scale(1,1,0.66),...delt(0.2,0.08)]),
 pelvis:SG(1,14,10).scale(0.165,0.11,0.12).translate(0,0.93,0),eyeW:mergeGeos([SG(1,10,8).scale(0.017,0.0105,0.006).translate(0.035,0.14,0.097),SG(1,10,8).scale(0.017,0.0105,0.006).translate(-0.035,0.14,0.097)]),
 lips:mergeGeos([SG(1,10,6).scale(0.024,0.0065,0.009).translate(0,0.083,0.1),SG(1,10,6).scale(0.021,0.0075,0.009).translate(0,0.074,0.098)]),
 sleeve:new THREE.CylinderGeometry(0.066,0.061,0.13,12).translate(0,-0.055,0),
 skirt:new THREE.LatheGeometry(V2L([[0.001,-0.43],[0.235,-0.42],[0.215,-0.3],[0.19,-0.12],[0.17,0.02],[0.162,0.07],[0.001,0.08]]),20).scale(1,1,0.74),
 belt:new THREE.TorusGeometry(0.153,0.017,6,28).rotateX(Math.PI/2).scale(1,1,0.63).translate(0,0.035,0),
 head:mergeGeos([SG(0.102,16,12).scale(1,1.13,1.05).translate(0,0.13,0),SG(0.085,16,12).scale(1,0.8,1).translate(0,0.075,0.022),SG(1,10,8).scale(0.016,0.026,0.022).translate(0,0.12,0.103),SG(1,8,6).scale(0.012,0.028,0.02).translate(0.101,0.125,0),SG(1,8,6).scale(0.012,0.028,0.02).translate(-0.101,0.125,0),new THREE.CylinderGeometry(0.045,0.05,0.1,10).translate(0,0.0,0)]),
 face:mergeGeos([SG(1,8,6).scale(0.0075,0.0075,0.005).translate(0.035,0.14,0.1),SG(1,8,6).scale(0.0075,0.0075,0.005).translate(-0.035,0.14,0.1),new THREE.BoxGeometry(0.032,0.007,0.008).translate(0.036,0.158,0.098),new THREE.BoxGeometry(0.032,0.007,0.008).translate(-0.036,0.158,0.098),new THREE.BoxGeometry(0.034,0.005,0.006).translate(0,0.072,0.1)]),
 hair0:mergeGeos([new THREE.SphereGeometry(0.11,18,10,0,Math.PI*2,0,1.3).scale(1.04,1.12,1.08).translate(0,0.14,-0.006),SG(1,12,8).scale(0.085,0.03,0.05).translate(0,0.235,0.06)]),
 hair1:mergeGeos([new THREE.SphereGeometry(0.11,18,10,0,Math.PI*2,0,1.4).scale(1.05,1.12,1.08).translate(0,0.14,-0.006),SG(1,14,10).scale(0.11,0.19,0.065).translate(0,0.07,-0.075),SG(1,10,8).scale(0.03,0.14,0.05).translate(0.095,0.08,-0.01),SG(1,10,8).scale(0.03,0.14,0.05).translate(-0.095,0.08,-0.01)]),
 hair2:mergeGeos([new THREE.SphereGeometry(0.11,18,10,0,Math.PI*2,0,1.35).scale(1.04,1.12,1.08).translate(0,0.14,-0.006),SG(0.05,12,10).translate(0,0.22,-0.085)]),
 hair3:mergeGeos([new THREE.SphereGeometry(0.11,18,10,0,Math.PI*2,0,1.35).scale(1.04,1.12,1.08).translate(0,0.14,-0.006),SG(0.035,10,8).translate(0,0.17,-0.11),SG(1,10,8).scale(0.035,0.14,0.035).translate(0,0.04,-0.125)]),
 hair4:lumpy(0.125,0.12).translate(0,0.17,-0.012),
 beard:new THREE.SphereGeometry(0.093,16,10,Math.PI*0.08,Math.PI*0.84,Math.PI*0.5,Math.PI*0.38).scale(1.02,1.05,1.08).translate(0,0.12,0.012),
 cap:mergeGeos([new THREE.SphereGeometry(0.114,18,10,0,Math.PI*2,0,1.2).scale(1.04,1.0,1.08).translate(0,0.15,-0.004),new THREE.CylinderGeometry(0.09,0.09,0.012,16,1,false,-Math.PI/2,Math.PI).scale(1,1,1.1).translate(0,0.19,0.075)]),
 glasses:mergeGeos([new THREE.TorusGeometry(0.022,0.004,6,16).translate(0.036,0.142,0.104),new THREE.TorusGeometry(0.022,0.004,6,16).translate(-0.036,0.142,0.104),new THREE.BoxGeometry(0.03,0.005,0.005).translate(0,0.145,0.106)]),
 bag:roundedBox(0.28,0.36,0.14,0.045).translate(0,0.38,-0.17),
 phone:new THREE.BoxGeometry(0.07,0.13,0.012).translate(0,-0.33,0.035),
 thigh:new THREE.LatheGeometry(V2L([[0.001,-0.44],[0.057,-0.43],[0.062,-0.39],[0.073,-0.29],[0.082,-0.16],[0.086,-0.06],[0.081,0],[0.001,0.025]]),14).scale(1,1,0.93),shin:new THREE.LatheGeometry(V2L([[0.001,-0.44],[0.041,-0.43],[0.043,-0.37],[0.053,-0.25],[0.064,-0.14],[0.061,-0.05],[0.057,0],[0.001,0.02]]),14).scale(1,1,0.93),
 shoe:mergeGeos([roundedBox(0.1,0.035,0.25,0.015).translate(0,-0.455,0.04),SG(1,12,8).scale(0.05,0.04,0.1).translate(0,-0.425,0.045)]),
 upper:new THREE.LatheGeometry(V2L([[0.001,-0.3],[0.044,-0.29],[0.049,-0.23],[0.057,-0.14],[0.059,-0.06],[0.057,0],[0.001,0.03]]),12).scale(1,1,0.92),
 fore:mergeGeos([new THREE.LatheGeometry(V2L([[0.001,-0.27],[0.033,-0.26],[0.035,-0.2],[0.044,-0.1],[0.047,-0.04],[0.043,0],[0.001,0.02]]),10).scale(1,1,0.9),SG(1,10,8).scale(0.036,0.06,0.024).translate(0,-0.31,0.004),SG(1,8,6).scale(0.014,0.03,0.014).translate(-0.028,-0.29,0.018)])};
const fabric=k=>['torsoM','torsoF','dress','jacket','pelvis','thigh','shin','upper','bag','sleeve','skirt'].includes(k);
const PI_={};for(const k in PG){const two=['thigh','shin','shoe','upper','fore','sleeve'].includes(k);const mat=M(0xffffff,k==='head'||k==='fore'?0.55:k==='glasses'||k==='phone'?0.3:k.startsWith('hair')||k==='beard'?0.75:0.85,fabric(k)?{normalMap:fabN,normalScale:new THREE.Vector2(0.6,0.6)}:{});if(k==='jacket')mat.side=THREE.DoubleSide;PI_[k]=new THREE.InstancedMesh(PG[k],mat,PN*(two?2:1));}
{const cc=new THREE.Color(),set=(m,i,h)=>m.setColorAt(i,cc.set(h).convertSRGBToLinear()),opt=['belt','torsoM','torsoF','dress','jacket','hair0','hair1','hair2','hair3','hair4','beard','cap','glasses','bag','phone'];
 peds.forEach((p,i)=>{p.child=Math.random()<0.1;p.jog=!p.child&&Math.random()<0.1;p.talk=Math.random()<0.35;p.photo=Math.random()<0.4;if(p.jog)p.speed=rand(2.6,3.4);if(p.child)p.speed*=0.9;p.hs=p.child?rand(0.56,0.7):rand(0.93,1.07);p.wide=rand(0.9,1.14);const r=Math.random();p.type=r<0.5?0:r<0.8?1:2;p.old=Math.random()<0.08;p.phone=!p.old&&Math.random()<0.14;
  if(p.old)p.speed*=0.7;
  p.hairK=p.type===0?pick(['hair0','hair0','hair0','hair4',null]):pick(['hair1','hair1','hair2','hair3','hair4','hair0']);
  p.beard=p.type===0&&Math.random()<0.28;p.cap=Math.random()<0.1&&p.hairK!=='hair1';if(p.cap&&p.hairK!=='hair0')p.hairK=null;p.glasses=Math.random()<(p.old?0.6:0.14);p.bag=p.type!==2&&Math.random()<0.2;p.jacket=p.type!==2&&Math.random()<0.35;
  p.skirt=p.type===1&&!p.jog&&Math.random()<0.3;p.short=!p.jacket&&p.type!==2&&Math.random()<0.45;if(p.jog){p.short=true;p.skirt=false;}if(p.jacket)p.short=false;
  if(p.child){p.beard=false;p.phone=false;p.old=false;p.glasses=Math.random()<0.08;p.bag=Math.random()<0.4;p.jacket=false;}if(p.jog){p.phone=false;p.bag=false;p.jacket=false;if(p.type===2)p.type=1;}
  p.torsoK=p.type===0?'torsoM':p.type===1?'torsoF':'dress';
  const top=pick([0xc62a34,0xe9e9e6,0x2d66cf,0x3d5a3a,0xe8b923,0x7a3f8f,0x1b1d22,0xd0661f,0x9aa5b0,0x6b8f71,0xf0c0c8,0x2a4a7a,0x8a6a4a,0x4a4f58,0xf2efe8]),skin=pick([0xe8c1a0,0xd9a77f,0xc99a7a,0x9a6a4a,0x6b4a33,0xf0cfb2,0xb88762]),
   jk=pick([0x2b2d31,0x5a4632,0x3a4a5e,0x6b6f78,0x7a1f24,0x3d5a3a,0xb8a888]),pants=(p.type===2||p.skirt)?skin:pick([0x2b3a55,0x1b1d22,0x5a4a3a,0x3a3f45,0x2a4a7a,0x6b6f78,0xbfae8e,0x3a4a6a]),
   shoe=pick([0x1b1d22,0x5a3a26,0xe9e9e6,0x2a2a2a,0x8a2b1d,0xd8d4cc]),hair=p.old?pick([0xb8b8b8,0xd8d8d8,0x8a8a8a]):pick([0x1b1410,0x3a2616,0x6b4424,0xb88a4a,0x2a2a2a,0x5a2a14,0xd8b878]);
  for(const k of opt){PI_[k].setMatrixAt(i,ZM);}PI_.skirt.setMatrixAt(i,ZM);PI_.sleeve.setMatrixAt(i*2,ZM);PI_.sleeve.setMatrixAt(i*2+1,ZM);
  const topC=p.jog?pick([0xff5a36,0x2fd2c6,0xf2e600,0x3a7bff,0xff3fa4,0xf2f2f2]):top;set(PI_[p.torsoK],i,topC);set(PI_.skirt,i,pick([0x1b1d22,0x3a2f4a,0x7a1f2b,0x2a4a6a,0xc9b48f,0x5a6b4a,0x8a8f96]));for(const k of[0,1])set(PI_.sleeve,i*2+k,topC);set(PI_.eyeW,i,0xf0ece4);set(PI_.lips,i,new THREE.Color(skin).lerp(new THREE.Color(0xa04a48),0.35).getHex());set(PI_.belt,i,pick([0x2a1c14,0x1b1d22,0x5a3a26]));set(PI_.jacket,i,jk);set(PI_.pelvis,i,pants);set(PI_.head,i,skin);set(PI_.face,i,0x2a1c14);for(const k of['hair0','hair1','hair2','hair3','hair4','beard'])set(PI_[k],i,hair);
  set(PI_.cap,i,pick([0x1b1d22,0xc62a34,0x2a4a7a,0xe9e9e6,0x3d5a3a]));set(PI_.glasses,i,0x141414);set(PI_.bag,i,pick([0x1b1d22,0x3a4a5e,0x7a1f24,0x5a4632,0x6b8f71]));set(PI_.phone,i,0x111316);
  for(const k of[0,1]){set(PI_.thigh,i*2+k,pants);set(PI_.shin,i*2+k,p.jog?skin:pants);set(PI_.shoe,i*2+k,shoe);set(PI_.upper,i*2+k,p.jacket?jk:(p.type===2||p.short)?skin:top);set(PI_.fore,i*2+k,skin);}});}
Object.values(PI_).forEach(m=>{m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.castShadow=m!==PI_.face&&m!==PI_.glasses&&m!==PI_.phone;m.receiveShadow=true;m.frustumCulled=false;scene.add(m);});
const _mB=new THREE.Matrix4(),_mL=new THREE.Matrix4(),_mR=new THREE.Matrix4(),_mT=new THREE.Matrix4(),_mH=new THREE.Matrix4(),_mU=new THREE.Matrix4(),_mC=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_pv=new V3(),_one=new V3(1,1,1),_hs=new V3();
const PED_LOD_HIDE=['face','eyeW','lips','glasses','beard','belt','phone'];
const _mChildHead=new THREE.Matrix4().makeScale(1.25,1.25,1.25);
function relM(parent,out,px,py,pz,rx,ry,rz){_mL.compose(_pv.set(px,py,pz),_q.setFromEuler(_e.set(rx,ry,rz)),_one);out.multiplyMatrices(parent,_mL);return out;}
let pedFrame=0,pedRelocT=0;
let pedSpread=false;
function relocatePeds(dt){pedRelocT-=dt;if(pedRelocT>0)return;pedRelocT=0.3;const px=pl.pos.x,pz=pl.pos.z;let moved=0;const first=!pedSpread;pedSpread=true;const rMin=first||camera.position.y>30||Math.hypot(pl.vel.x,pl.vel.z)>40?8:92;
 for(const p of peds){if(p.gone)continue;const dx=p.x-px,dz=p.z-pz;if(!first&&(dx*dx+dz*dz<150*150||p.down>0))continue;if(!first&&++moved>220)break;
  for(let t=0;t<6;t++){const a=rand(0,6.283),r=Math.sqrt(rand(rMin*rMin,146*146)),x=px+Math.cos(a)*r,z=pz+Math.sin(a)*r;if(Math.abs(x)>OUT_R-30||Math.abs(z)>OUT_R-30)continue;p.bi=Math.floor((x+HALF-ROAD/2)/PITCH);p.bj=Math.floor((z+HALF-ROAD/2)/PITCH);if(p.bj===RJ)p.bj+=Math.random()<0.5?1:-1;p.s=rand(0,170);p.panic=0;p.wait=0;pedPlace(p);break;}}}


function updatePeds(dt){pedFrame++;const cx=camera.position.x,cz=camera.position.z;const cap=Math.min(PN,PED_CAP);
 for(let i=0;i<PN;i++){const p=peds[i];if(p.gone)continue;if(i>=cap){continue;}
  if(p.down>0){p.down-=dt;if(p.kv){p.kv.y+=G*dt;p.kx+=p.kv.x*dt;p.ky+=p.kv.y*dt;p.kz+=p.kv.z*dt;p.rot+=p.spin*dt;const gy=inRiver(p.kx,p.kz)?WATER_Y:0.02;if(p.ky<=gy){p.ky=gy;p.kv=null;p.rot=0;}}
   if(p.down<=0){if(CITY_EMPTY||(WAVE.on&&WAVE.mode===1)){p.gone=true;hidePed(i);continue;}p.bi+=p.bi<CI?6:-6;p.s=rand(0,170);continue;}
   p.x=p.kx;p.z=p.kz;const f=Math.min(1,p.down);
   _mB.compose(_pv.set(p.kx,p.ky+0.1,p.kz),_q.setFromEuler(_e.set(-Math.PI/2+p.rot,p.ry,0)),_hs.set(p.hs*p.wide*f,p.hs*f,p.hs*p.wide*f));
   PI_.pelvis.setMatrixAt(i,relM(_mB,_mR,0,0,0,0,0,0));relM(_mB,_mT,0,0.9,0,0,0,0);PI_[p.torsoK].setMatrixAt(i,_mT);if(p.type!==2&&!p.jog&&!p.skirt)PI_.belt.setMatrixAt(i,_mT);if(p.skirt)PI_.skirt.setMatrixAt(i,_mT);if(p.jacket)PI_.jacket.setMatrixAt(i,_mT);if(p.bag)PI_.bag.setMatrixAt(i,_mT);
   relM(_mT,_mH,0,0.63,0,0.2,0.5,0);PI_.head.setMatrixAt(i,_mH);PI_.face.setMatrixAt(i,_mH);PI_.eyeW.setMatrixAt(i,_mH);PI_.lips.setMatrixAt(i,_mH);if(p.hairK)PI_[p.hairK].setMatrixAt(i,_mH);if(p.beard)PI_.beard.setMatrixAt(i,_mH);if(p.cap)PI_.cap.setMatrixAt(i,_mH);if(p.glasses)PI_.glasses.setMatrixAt(i,_mH);
   for(const k of[0,1]){const sg=k?1:-1;relM(_mB,_mU,sg*0.095,0.9,0,0,0,sg*0.18);PI_.thigh.setMatrixAt(i*2+k,_mU);relM(_mU,_mC,0,-0.44,0,0.15,0,0);PI_.shin.setMatrixAt(i*2+k,_mC);PI_.shoe.setMatrixAt(i*2+k,_mC);relM(_mT,_mU,sg*0.2,0.55,0,-0.3,0,sg*1.2);PI_.upper.setMatrixAt(i*2+k,_mU);if(p.short)PI_.sleeve.setMatrixAt(i*2+k,_mU);relM(_mU,_mC,0,-0.29,0,-0.4,0,0);PI_.fore.setMatrixAt(i*2+k,_mC);}
   if(p.phone)PI_.phone.setMatrixAt(i,ZM);continue;}
  if(state==='play'&&!civOn&&!pl.dead&&!PHASE_ON&&pl.pos.y<2.6){const dx=p.x-pl.pos.x,dz=p.z-pl.pos.z;const tr=SIZE>5?SIZE*0.32:1.52;if(dx*dx+dz*dz<tr*tr){const hsp=Math.hypot(pl.vel.x,pl.vel.z);if(hsp>(SIZE>5?2:15)){knockPed(p,new V3(pl.vel.x/hsp,0,pl.vel.z/hsp),Math.min(30,hsp*0.4));panicAt(new V3(p.x,0,p.z));continue;}}}const hdx=pl.pos.x-p.x,hdz=pl.pos.z-p.z;p.watch=state==='play'&&!civOn&&!pl.dead&&p.panic<=0&&!p.jog&&pl.pos.y<14&&hdx*hdx+hdz*hdz<484;
  if(p.panic>0){p.panic-=dt;p.wait=0;}if(p.wait>0)p.wait-=dt;else if(Math.random()<dt*0.04)p.wait=rand(2,7);const idle=(p.wait>0||p.watch)&&p.panic<=0;
  if(!idle){p.s+=p.dir*(p.panic>0?4.6:p.speed)*dt;p.ph+=dt*(p.panic>0?11:p.jog?9.5:(p.old?5.2:p.child?7.4:6.2));}else p.ph=lerp(p.ph,Math.round(p.ph/Math.PI)*Math.PI,damp(6,dt));pedPlace(p);
  if(p.watch){p.wry=turnAngle(p.wry==null?p.ry:p.wry,Math.atan2(hdx,hdz),damp(4,dt));p.ry=p.wry;}else p.wry=p.ry;
  const far=(p.x-cx)*(p.x-cx)+(p.z-cz)*(p.z-cz)>220*220;if(far&&(pedFrame+i)%4)continue;
  const run=p.panic>0?1:(p.jog&&!idle?0.75:0),wk=idle?0:1,stride=(p.old?0.6:1)*(0.42+0.35*run),sw=Math.sin(p.ph)*stride*wk,bob=Math.abs(Math.cos(p.ph))*(0.028+0.03*run)*wk,twist=-Math.sin(p.ph)*0.12*wk,sway=Math.sin(p.ph)*0.035*wk;
  _mB.compose(_pv.set(p.x,bob,p.z),_q.setFromEuler(_e.set(0,p.ry,0)),_hs.set(p.hs*p.wide,p.hs,p.hs*p.wide));
  PI_.pelvis.setMatrixAt(i,relM(_mB,_mR,0,0,0,0,twist*0.3,sway));
  relM(_mB,_mT,0,0.9,0,(p.old?0.14:0.02)+0.18*run+(p.phone&&!run?0.06:0),twist,sway*0.6);PI_[p.torsoK].setMatrixAt(i,_mT);if(p.type!==2&&!p.jog&&!p.skirt)PI_.belt.setMatrixAt(i,_mT);if(p.skirt)PI_.skirt.setMatrixAt(i,_mT);if(p.jacket)PI_.jacket.setMatrixAt(i,_mT);if(p.bag)PI_.bag.setMatrixAt(i,_mT);
  const look=p.watch?0:idle?Math.sin(time*0.6+i*1.7)*0.7:-twist*0.8,nod=p.watch?-0.14:p.phone&&!run?0.45:(p.old?-0.08:0)+0.05*run;
  relM(_mT,_mH,0,0.63,0,nod,look,-sway*0.5);if(p.child)_mH.multiply(_mChildHead);PI_.head.setMatrixAt(i,_mH);PI_.face.setMatrixAt(i,_mH);PI_.eyeW.setMatrixAt(i,_mH);PI_.lips.setMatrixAt(i,_mH);if(p.hairK)PI_[p.hairK].setMatrixAt(i,_mH);if(p.beard)PI_.beard.setMatrixAt(i,_mH);if(p.cap)PI_.cap.setMatrixAt(i,_mH);if(p.glasses)PI_.glasses.setMatrixAt(i,_mH);
  for(const k of[0,1]){const s=k?1:-1,a=k?sw:-sw;relM(_mB,_mU,s*0.095,0.9,0,a,0,0);PI_.thigh.setMatrixAt(i*2+k,_mU);const kb=(0.06+Math.max(0,-Math.cos(p.ph+(k?Math.PI:0)))*(0.55+0.4*run))*wk+0.03;relM(_mU,_mC,0,-0.44,0,kb,0,0);PI_.shin.setMatrixAt(i*2+k,_mC);PI_.shoe.setMatrixAt(i*2+k,_mC);
   const phoneArm=p.phone&&!run&&k===1&&!p.watch,photoArm=p.watch&&p.photo&&k===1;let armA=photoArm?-1.35:phoneArm?-0.35:-a*0.85+(run?-0.3:0),elbow=photoArm?-0.45:phoneArm?-1.55:-(0.2+0.22*wk+0.7*run);
   if(idle&&p.talk&&!p.watch&&!phoneArm&&k===((i%2)?1:0)){armA=-0.25+0.3*Math.sin(time*2.4+i);elbow=-(0.9+0.45*Math.sin(time*3.3+i*1.3));}
   relM(_mT,_mU,s*0.2,0.55,0,armA,0,s*(0.07+0.02*p.wide));PI_.upper.setMatrixAt(i*2+k,_mU);if(p.short)PI_.sleeve.setMatrixAt(i*2+k,_mU);relM(_mU,_mC,0,-0.29,0,elbow,phoneArm?0.35:0,0);PI_.fore.setMatrixAt(i*2+k,_mC);if(phoneArm||photoArm)PI_.phone.setMatrixAt(i,_mC);else if(k===1&&!p.phone)PI_.phone.setMatrixAt(i,ZM);}
  if((p.x-cx)*(p.x-cx)+(p.z-cz)*(p.z-cz)>12100){for(const kk of PED_LOD_HIDE)PI_[kk].setMatrixAt(i,ZM);}}
 Object.values(PI_).forEach(m=>{m.instanceMatrix.needsUpdate=true;});}


/* helicopters and blimp */
function buildHeli(color){const g=new THREE.Group(),m=M(color,0.35,{metalness:0.4}),dk=M(0x1b1d22,0.5,{metalness:0.5}),gl=M(0x1c2530,0.08,{metalness:0.6});
 const body=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),m);body.scale.set(1.3,1.2,2.4);const nose=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),gl);nose.scale.set(1.08,0.85,1.1);nose.position.set(0,0.15,1.35);
 const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.34,5,10),m);tail.rotation.x=Math.PI/2;tail.position.set(0,0.35,-4.2);const fin=new THREE.Mesh(boxGeo,m);fin.scale.set(0.12,1.5,0.9);fin.position.set(0,1,-6.5);
 const sk=new THREE.Mesh(mergeBoxes([{w:0.12,h:0.12,d:3.4,x:-0.95,y:-1.55,z:0},{w:0.12,h:0.12,d:3.4,x:0.95,y:-1.55,z:0},{w:0.08,h:0.6,d:0.08,x:-0.85,y:-1.25,z:0.9},{w:0.08,h:0.6,d:0.08,x:0.85,y:-1.25,z:0.9},{w:0.08,h:0.6,d:0.08,x:-0.85,y:-1.25,z:-0.9},{w:0.08,h:0.6,d:0.08,x:0.85,y:-1.25,z:-0.9}]),dk);
 const rotor=new THREE.Group();rotor.position.y=1.45;const b1=new THREE.Mesh(boxGeo,dk);b1.scale.set(11,0.05,0.35);const b2=b1.clone();b2.rotation.y=Math.PI/2;rotor.add(b1,b2);const tr=new THREE.Mesh(boxGeo,dk);tr.scale.set(0.05,1.8,0.22);tr.position.set(0.25,1,-6.5);
 g.add(body,nose,tail,fin,sk,rotor,tr);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(g);return{g,rotor,tr};}
const helis=[Object.assign(buildHeli(0xe9e9e6),{a:0,R:170,alt:120,sp:0.13}),Object.assign(buildHeli(0xb8322a),{a:3,R:250,alt:165,sp:-0.09}),Object.assign(buildHeli(0x1f4fa8),{a:1.5,R:90,alt:210,sp:0.18})];
const blimp={g:new THREE.Group(),a:1,R:340,alt:270,sp:0.025};
{const hull=new THREE.Mesh(new THREE.SphereGeometry(1,32,18),M(0xd8dadc,0.5,{metalness:0.2}));hull.scale.set(7.5,7.5,26);const gon=new THREE.Mesh(boxGeo,M(0x2a2d31,0.4,{metalness:0.5}));gon.scale.set(2.4,1.8,6);gon.position.y=-7.6;
 const fins=new THREE.Mesh(mergeBoxes([{w:0.3,h:7,d:5,x:0,y:3.5,z:-22},{w:0.3,h:7,d:5,x:0,y:-3.5,z:-22},{w:7,h:0.3,d:5,x:3.5,y:0,z:-22},{w:7,h:0.3,d:5,x:-3.5,y:0,z:-22}]),M(0x1f4fa8,0.5));
 const adM=adMats[4];for(const s of[-1,1]){const pnl=new THREE.Mesh(new THREE.PlaneGeometry(26,5.8),adM);pnl.position.set(s*7.2,0,0);pnl.rotation.y=s*Math.PI/2;blimp.g.add(pnl);}
 blimp.g.add(hull,gon,fins);blimp.g.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(blimp.g);}
function updateCity(dt){if(dt<=0)return;sortLanes(dt);updateSignals();
 for(let i=0;i<cars.length;i++){const c=cars[i];
  if(c.state===3){if(HELD!==c||pl.dead||civOn){if(HELD===c)HELD=null;c.state=0;launchCar(c,new V3(0,-2,0));}else{const hp=holdPoint();c.pos.lerp(hp,Math.min(1,dt*14));c.rx=lerp(c.rx,0,Math.min(1,dt*6));c.rz=lerp(c.rz,0,Math.min(1,dt*6));c.ry=pl.facing;drawCar(c,i);continue;}}
  if(c.state===2){if(time>c.respawn){c.state=0;c.rx=c.rz=0;c.vel.set(0,0,0);if(c.moving){c.along=c.lane.dir>0?-LANE_LEN/2:LANE_LEN/2;}else{c.pos.copy(c.home);c.ry=c.homeRy;}}else{hideCar(c,i);continue;}}
  if(c.state===0&&c.moving){const vt=carTargetSpeed(c);c.speed+=clamp(vt-c.speed,-8*dt,3*dt);c.along+=c.lane.dir*c.speed*dt;c.roll+=c.speed*dt/CT[c.type].wr;if(c.along>LANE_LEN/2)c.along-=LANE_LEN;if(c.along<-LANE_LEN/2)c.along+=LANE_LEN;if(c.lane.ax===0){c.pos.set(c.along,0,c.lane.c);c.ry=c.lane.dir>0?Math.PI/2:-Math.PI/2;}else{c.pos.set(c.lane.c,0,c.along);c.ry=c.lane.dir>0?0:Math.PI;}}
  if(c.state===0){const dx=c.pos.x-pl.pos.x,dz=c.pos.z-pl.pos.z;if(SIZE>5&&!pl.dead&&pl.pos.y<4&&dx*dx+dz*dz<(SIZE*0.35)*(SIZE*0.35)&&Math.hypot(pl.vel.x,pl.vel.z)>2){destroyCar(c);continue;}
   if(!PHASE_ON&&dx*dx+dz*dz<9&&pl.pos.y<2.4&&!pl.dead){const sp=pl.vel.length();if(sp>70)launchCar(c,pl.vel.clone().multiplyScalar(0.8).setY(sp*0.3+4));}
   for(const e of enemies){if(e.type==='boss'&&!e.dead&&Math.hypot(e.pos.x-c.pos.x,e.pos.z-c.pos.z)<5){destroyCar(c);break;}}}
  if(c.state===1){c.vel.y+=G*dt;c.pos.addScaledVector(c.vel,dt);c.rx+=c.av.x*dt;c.ry+=c.av.y*dt;c.rz+=c.av.z*dt;c.smokeT-=dt;if(c.smokeT<=0){c.smokeT=0.05;emit(dustPS,c.pos.x,c.pos.y+0.8,c.pos.z,rand(-1,1),rand(0,2),rand(-1,1),1.4,1.5,4,0.3,0.3,0.31,0.6,0.4,0.3);}
   let hitB=null;for(const b of buildings){if(!b.alive)continue;const q=b.col;if(c.pos.x>q.minX&&c.pos.x<q.maxX&&c.pos.z>q.minZ&&c.pos.z<q.maxZ&&c.pos.y<q.maxY){hitB=b;break;}}
   if(hitB){damageBuilding(hitB,c.vel.length()*4*ST.dmg,c.pos.clone(),true);destroyCar(c);}
   else if(c.pos.y<=0&&c.vel.y<0){c.pos.y=0;destroyCar(c);}
   else for(const e of enemies){if(!e.dead&&Math.hypot(e.pos.x-c.pos.x,e.pos.y+e.cy-c.pos.y,e.pos.z-c.pos.z)<e.r+2){damageEnemy(e,70*ST.dmg,c.vel.clone().multiplyScalar(0.5));destroyCar(c);break;}}
   if(c.state===2){i--;continue;}}
  drawCar(c,i);}
 carsNeedUpdate();
 relocatePeds(dt);updatePeds(dt);
 for(const h of helis){h.a+=h.sp*dt;const x=Math.cos(h.a)*h.R,z=Math.sin(h.a)*h.R;h.g.position.set(x,h.alt+Math.sin(time*0.5+h.R)*6,z);h.g.rotation.set(0,Math.atan2(-Math.sin(h.a)*Math.sign(h.sp),Math.cos(h.a)*Math.sign(h.sp)),-0.12*Math.sign(h.sp));h.rotor.rotation.y+=dt*38;h.tr.rotation.x+=dt*50;}
 blimp.a+=blimp.sp*dt;blimp.g.position.set(Math.cos(blimp.a)*blimp.R,blimp.alt,Math.sin(blimp.a)*blimp.R);blimp.g.rotation.y=Math.atan2(-Math.sin(blimp.a),Math.cos(blimp.a));
 for(const c of cranes)c.g.rotation.y+=c.sp*dt;}
/* ground contact shadows */
const aoTex=cv(128,128,(g,w,h)=>{g.fillStyle='#000';g.fillRect(0,0,w,h);for(let i=0;i<24;i++){const m=4+i/24*40;g.fillStyle='rgba(255,255,255,0.055)';g.fillRect(m,m,w-2*m,h-2*m);}},true);
const aoI=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x000000,alphaMap:aoTex,transparent:true,depthWrite:false,opacity:0.6,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),buildings.length);
buildings.forEach((b,i)=>{dm.position.set(b.x,0.1,b.z);dm.rotation.set(0,0,0);dm.scale.set(b.y0>0?0:b.w+9,1,b.y0>0?0:b.d+9);dm.updateMatrix();aoI.setMatrixAt(i,dm.matrix);});aoI.renderOrder=1;scene.add(aoI);
scene.traverse(o=>{const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];ms.forEach(m=>{if(m.isMeshStandardMaterial)m.envMapIntensity=0.85;});if(o.isInstancedMesh)o.frustumCulled=false;});
function setAO(b,on){if(b.y0>0)return;dm.position.set(b.x,0.1,b.z);dm.rotation.set(0,0,0);dm.scale.set(on?b.w+9:0,1,on?b.d+9:0);dm.updateMatrix();aoI.setMatrixAt(b.ai,dm.matrix);aoI.instanceMatrix.needsUpdate=true;}
/* outer districts: dense instanced neighbourhoods filling the world */
const OUT_R=1300,outer=[];
const WUV='#include <uv_vertex>\n#ifdef USE_INSTANCING\nvec4 wpI=modelMatrix*instanceMatrix*vec4(position,1.0);vec3 nI=normalize(mat3(instanceMatrix)*normal);\n#else\nvec4 wpI=modelMatrix*vec4(position,1.0);vec3 nI=normal;\n#endif\nvUv=(abs(nI.x)>0.5?vec2(wpI.z,wpI.y):vec2(wpI.x,wpI.y))/vec2(5.0,4.0);';
const O_STY=[3,4,5,6,7,8,0];
const oMats=O_STY.map(si=>{const m=STY[si].mat.clone();m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <uv_vertex>',WUV);aoPatch(sh);};m.customProgramCacheKey=()=>'worlduv-ao';return m;});
const oWallGeo=(()=>{const g=new THREE.BoxGeometry(1,1,1);g.translate(0,0.5,0);const src=g.index.array,idx=[];for(const f of[0,1,4,5])for(let k=0;k<6;k++)idx.push(src[f*6+k]);g.setIndex(idx);return g;})();
const oRoofGeo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
const oSlabs=[],oTrees=[];
{const NB=Math.ceil((OUT_R-HALF)/PITCH)+1;
 for(let bi=-NB;bi<N+NB;bi++)for(let bj=-NB;bj<N+NB;bj++){if(bj===RJ||(bi>=0&&bi<N&&bj>=0&&bj<N))continue;
  const x0=-HALF+ROAD/2+bi*PITCH,z0=-HALF+ROAD/2+bj*PITCH,cx=x0+BLOCK/2,cz=z0+BLOCK/2;if(Math.abs(cx)>OUT_R||Math.abs(cz)>OUT_R)continue;
  oSlabs.push([cx,cz]);const r=Math.max(Math.abs(cx),Math.abs(cz));
  for(const t of[-15,0,15])for(let sd=0;sd<4;sd++)if(Math.random()<0.45){const p=sd===0?[cx+t,z0+0.95]:sd===1?[x0+BLOCK-0.95,cz+t]:sd===2?[cx+t,z0+BLOCK-0.95]:[x0+0.95,cz+t];oTrees.push(p);}
  const roll=Math.random();
  if(roll<0.07){for(let k=0;k<12;k++)oTrees.push([cx+rand(-18,18),cz+rand(-18,18)]);continue;}
  if(roll<0.12){const w=rand(34,40),d=rand(34,40);outer.push({x:cx,z:cz,w,d,h:rand(8,14),si:pick([1,6])});continue;}
  const three=r<700&&Math.random()<0.5;
  if(three){const L=40/3;for(let li=0;li<3;li++)for(let lj=0;lj<3;lj++){const lcx=x0+2+L*(li+0.5),lcz=z0+2+L*(lj+0.5);if(li===1&&lj===1){oTrees.push([lcx,lcz]);continue;}const w=rand(10.4,12.9),d=rand(10.4,12.9);outer.push({x:lcx+rand(-(L-w)/2,(L-w)/2),z:lcz+rand(-(L-d)/2,(L-d)/2),w,d,h:rand(14,30)+Math.pow(Math.random(),2)*30,si:randi(0,O_STY.length-1)});}}
  else for(let li=0;li<2;li++)for(let lj=0;lj<2;lj++){const lcx=x0+2+li*21+9.5,lcz=z0+2+lj*21+9.5;if(Math.random()<0.07){oTrees.push([lcx,lcz]);continue;}const w=rand(12,18.5),d=rand(12,18.5);
   const h=r<700?rand(12,28)+Math.pow(Math.random(),2)*38:rand(6,16)+Math.pow(Math.random(),2)*14;outer.push({x:lcx+rand(-(19-w)/2,(19-w)/2),z:lcz+rand(-(19-d)/2,(19-d)/2),w,d,h,si:r<700?randi(0,O_STY.length-1):randi(0,5)});}}}
const oWalls=oMats.map((m,k)=>{const n=outer.filter(o=>o.si===k).length;const im=new THREE.InstancedMesh(oWallGeo,m,Math.max(1,n));im.castShadow=im.receiveShadow=true;scene.add(im);im.userData.n=0;return im;});
const oRoof=new THREE.InstancedMesh(oRoofGeo,roofMat,outer.length),oAc=new THREE.InstancedMesh(boxGeo,acMat,outer.length),oRubble=new THREE.InstancedMesh(boxGeo,rubbleMat,outer.length);
oRoof.receiveShadow=true;oAc.castShadow=true;oRubble.castShadow=oRubble.receiveShadow=true;scene.add(oRoof,oAc,oRubble);
const oGable=new THREE.InstancedMesh(prismGeo,M(0xffffff,0.8,{map:tileT}),outer.length);oGable.castShadow=oGable.receiveShadow=true;scene.add(oGable);
function oSet(o,on){const s=on?1:0;if(o.gable===undefined){o.gable=o.h<16&&Math.random()<0.55;o.grot=Math.random()<0.5;oGable.setColorAt(o.i,new THREE.Color(pick([0x9a4a32,0x7a3b2a,0x4a4d52,0x5a4632,0x3a3f45])).convertSRGBToLinear());}
 dm.position.set(o.x,o.h,o.z);dm.rotation.set(0,o.grot?Math.PI/2:0,0);const gs=on&&o.gable?1:0;if(gs)dm.scale.set((o.grot?o.d:o.w)+0.6,Math.min(o.w,o.d)*0.38,(o.grot?o.w:o.d)+0.4);else dm.scale.set(0,0,0);dm.updateMatrix();oGable.setMatrixAt(o.i,dm.matrix);oGable.instanceMatrix.needsUpdate=true;if(oGable.instanceColor)oGable.instanceColor.needsUpdate=true;dm.rotation.set(0,0,0);dm.position.set(o.x,0,o.z);dm.scale.set(o.w*s,o.h*s,o.d*s);dm.updateMatrix();oWalls[o.si].setMatrixAt(o.wi,dm.matrix);dm.position.set(o.x,o.h+0.02,o.z);dm.scale.set(o.w*s,1,o.d*s);dm.updateMatrix();oRoof.setMatrixAt(o.i,dm.matrix);
 dm.position.set(o.x+o.ax,o.h+0.8,o.z+o.az);dm.scale.set(o.ac*s,1.6*s,o.ac*s);dm.updateMatrix();oAc.setMatrixAt(o.i,dm.matrix);
 dm.position.set(o.x,1,o.z);dm.scale.set(on?0:o.w*0.92,on?0:2.2,on?0:o.d*0.92);dm.updateMatrix();oRubble.setMatrixAt(o.i,dm.matrix);
 oWalls[o.si].instanceMatrix.needsUpdate=oRoof.instanceMatrix.needsUpdate=oAc.instanceMatrix.needsUpdate=oRubble.instanceMatrix.needsUpdate=true;}
outer.forEach((o,i)=>{o.i=i;o.wi=oWalls[o.si].userData.n++;o.outer=true;o.alive=true;o.hp=o.maxHp=60+o.w*o.d*o.h*0.04;o.lastRam=-9;o.respawnAt=0;o.wallColor=STY[O_STY[o.si]].hex;o.ac=Math.random()<0.6?rand(2,3.5):0;o.ax=rand(-o.w/4,o.w/4);o.az=rand(-o.d/4,o.d/4);o.col={minX:o.x-o.w/2,maxX:o.x+o.w/2,minY:0,maxY:o.h,minZ:o.z-o.d/2,maxZ:o.z+o.d/2};oSet(o,true);});
{const sI=new THREE.InstancedMesh(slabGeo,slabMat,oSlabs.length);oSlabs.forEach((q,i)=>{dm.position.set(q[0],0.06,q[1]);dm.rotation.set(0,0,0);dm.scale.set(1,1,1);dm.updateMatrix();sI.setMatrixAt(i,dm.matrix);});sI.receiveShadow=true;scene.add(sI);
 const tI=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14,0.2,2.8,6),M(0x4e3a2b,0.9),oTrees.length),lI=new THREE.InstancedMesh(canopyGeoO,leafMat,oTrees.length);const tc=new THREE.Color();
 oTrees.forEach((p,i)=>{const s=rand(0.85,1.3);dm.rotation.set(0,rand(0,6),0);dm.position.set(p[0],1.4*s,p[1]);dm.scale.set(s,s,s);dm.updateMatrix();tI.setMatrixAt(i,dm.matrix);dm.position.y=3.9*s;dm.scale.set(s*1.15,s*1.3,s*1.15);dm.updateMatrix();lI.setMatrixAt(i,dm.matrix);lI.setColorAt(i,tc.set(pick([0x3f6b30,0x4d7a3a,0x5a7f35,0x3a5f2c])).convertSRGBToLinear());});
 tI.castShadow=lI.castShadow=true;scene.add(tI,lI);}
function crumbleOuter(o,pt){clearScorch(o);clearMarks(o);o.alive=false;o.respawnAt=time+200;oSet(o,false);prog.destroyed++;addXP(10+Math.round(o.h/6),'Bina yıkıldı');const mid=new V3(o.x,o.h*0.5,o.z);sfxAt('collapse',mid,520,1);addShakeAt(mid,0.9);
 spawnDebris(new V3(o.x,o.h*0.6,o.z),34,16,0.5,2.4,o.wallColor,0.8);for(let i=0;i<28;i++){const p=perimeterPoint(o,rand(0.5,o.h*0.7));dustBurst(p,1,10,2,4,11,2.6);}dustBurst(mid,20,8,4,5,14,3);}
/* spatial grid for collision (city + outer) */
const GRID=new Map(),gk=(i,j)=>(i+200)*1000+(j+200),gc=v=>Math.floor((v+HALF)/PITCH);
function gridAdd(b){const k=gk(gc(b.x),gc(b.z));let l=GRID.get(k);if(!l){l=[];GRID.set(k,l);}l.push(b);}
buildings.forEach(gridAdd);outer.forEach(gridAdd);
const _near=[];function solidsNear(x,z){_near.length=0;if(ARENA)return _near;const i=gc(x),j=gc(z);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=GRID.get(gk(i+a,j+b));if(l)for(const o of l)if(o.alive)_near.push(o);}return _near;}
const CLOUDS=[];
/* clouds */
{const ct=cv(256,128,(g,w,h)=>{for(let i=0;i<40;i++){const x=rand(40,w-40),y=rand(40,h-30),r=rand(18,42);const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,6.3);g.fill();}});
 for(let i=0;i<34;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:ct,transparent:true,opacity:rand(0.55,0.9),depthWrite:false,fog:false,color:lin(0xffffff)}));const a=rand(0,6.283),r=rand(150,1100);sp.position.set(Math.cos(a)*r,rand(320,520),Math.sin(a)*r);const w=rand(260,520);sp.scale.set(w,w*rand(0.3,0.45),1);sp.userData.op=sp.material.opacity;scene.add(sp);CLOUDS.push(sp);}}

scene.traverse(o=>{if(o.isInstancedMesh)o.frustumCulled=false;});
const CITY_A=scene.children.slice(_SC0);
/* ---------- hero ---------- */
const suitN=normalMapFrom(mkc(128,128,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);g.strokeStyle='#909090';g.lineWidth=2;const R=8,dx=R*1.732;for(let y=0,r=0;y<h+R;y+=R*1.5,r++)for(let x=(r%2)*dx/2;x<w+dx;x+=dx){g.beginPath();for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3;g.lineTo(x+Math.cos(a)*R,y+Math.sin(a)*R);}g.closePath();g.stroke();}}),1.5);suitN.repeat.set(3,3);
const capeN=normalMapFrom(mkc(64,64,(g,w,h)=>{for(let y=0;y<h;y++){const v=Math.round(200+Math.sin(y*0.8)*40);g.fillStyle='rgb('+v+','+v+','+v+')';g.fillRect(0,y,w,1);}}),1);capeN.repeat.set(1,6);
const HM={suit:M(0x1f4fa8,0.42,{metalness:0.08,normalMap:suitN,normalScale:new THREE.Vector2(0.6,0.6)}),acc:M(0xe8b923,0.28,{metalness:0.8}),cape:M(0xc62a34,0.75,{side:THREE.DoubleSide,normalMap:capeN,normalScale:new THREE.Vector2(0.5,0.5)}),skin:M(0xc99a7a,0.65),mask:M(0x121a2e,0.5),hair:M(0x241a14,0.8),eye:new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:0.3}),star:M(0xffffff,0.4)};
const hero=new THREE.Group();scene.add(hero);
const tiltG=new THREE.Group();tiltG.position.y=1;hero.add(tiltG);
const rig=new THREE.Group();rig.position.y=-1;rig.scale.setScalar(1.04);tiltG.add(rig);
function hadd(geo,mat,par,x,y,z,sx,sy,sz){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(sx)m.scale.set(sx,sy,sz);m.castShadow=true;par.add(m);return m;}
function limb(par,r1,r2,len,mat){const g=new THREE.CylinderGeometry(r1,r2,len,14);g.translate(0,-len/2,0);return hadd(g,mat,par,0,0,0);}
const sph=r=>new THREE.SphereGeometry(r,20,14);
function latheG(pts,seg){return new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg||32,Math.PI,Math.PI*2);}
function suitMaps(kind){const S=512,hc=mkc(S,S),cc=mkc(S,S),gh=hc.getContext('2d'),gc=cc.getContext('2d');gh.fillStyle='rgb(200,200,200)';gh.fillRect(0,0,S,S);gc.fillStyle='#ffffff';gc.fillRect(0,0,S,S);
 gh.strokeStyle='rgb(160,160,160)';gh.lineWidth=1.5;const R=7,dx=R*1.732;for(let y=0,r=0;y<S+R;y+=R*1.5,r++)for(let x=(r%2)*dx/2;x<S+dx;x+=dx){gh.beginPath();for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3;gh.lineTo(x+Math.cos(a)*R,y+Math.sin(a)*R);}gh.closePath();gh.stroke();}
 const groove=(fn,w)=>{for(const [g,col] of[[gh,'rgb(80,80,80)'],[gc,'rgba(0,0,0,0.2)']]){g.save();g.strokeStyle=col;g.lineWidth=w;g.lineCap='round';g.shadowColor=col;g.shadowBlur=w*1.6;g.beginPath();fn(g);g.stroke();g.restore();}};
 if(kind==='torso'){groove(g=>{g.moveTo(128,0);g.lineTo(128,S);g.moveTo(384,0);g.lineTo(384,S);},5);groove(g=>{g.moveTo(256,95);g.lineTo(256,430);},4);
  groove(g=>{g.moveTo(158,118);g.quadraticCurveTo(196,222,256,192);g.moveTo(354,118);g.quadraticCurveTo(316,222,256,192);},7);
  for(const y of[252,300,348])groove(g=>{g.moveTo(210,y);g.quadraticCurveTo(234,y+9,256,y+2);g.moveTo(302,y);g.quadraticCurveTo(278,y+9,256,y+2);},4);
  groove(g=>{g.moveTo(204,214);g.quadraticCurveTo(194,330,218,436);g.moveTo(308,214);g.quadraticCurveTo(318,330,294,436);},5);
  groove(g=>{g.moveTo(44,128);g.quadraticCurveTo(66,222,22,252);g.moveTo(468,128);g.quadraticCurveTo(446,222,490,252);g.moveTo(0,300);g.lineTo(0,470);g.moveTo(512,300);g.lineTo(512,470);},5);
  groove(g=>{g.moveTo(152,300);g.lineTo(196,476);g.moveTo(360,300);g.lineTo(316,476);},4);}
 else if(kind==='limb'){groove(g=>{g.moveTo(128,0);g.lineTo(128,S);g.moveTo(384,0);g.lineTo(384,S);},5);groove(g=>{g.moveTo(176,110);g.quadraticCurveTo(256,170,336,110);g.moveTo(186,300);g.quadraticCurveTo(256,350,326,300);},4);}
 return{map:tex(cc),nm:normalMapFrom(hc,3)};}
const tMaps=suitMaps('torso'),lMaps=suitMaps('limb');
HM.suitT=new THREE.MeshPhysicalMaterial({color:lin(0x1f4fa8),map:tMaps.map,normalMap:tMaps.nm,normalScale:new THREE.Vector2(1.1,1.1),roughness:0.36,metalness:0.05,clearcoat:0.35,clearcoatRoughness:0.35});
HM.suit=new THREE.MeshPhysicalMaterial({color:lin(0x1f4fa8),map:lMaps.map,normalMap:lMaps.nm,normalScale:new THREE.Vector2(1,1),roughness:0.38,metalness:0.05,clearcoat:0.3,clearcoatRoughness:0.4});
HM.acc=new THREE.MeshPhysicalMaterial({color:lin(0xe8b923),roughness:0.26,metalness:0.85,clearcoat:0.5,clearcoatRoughness:0.2});
HM.armor=new THREE.MeshPhysicalMaterial({color:lin(0x0f2a5c),roughness:0.3,metalness:0.7,clearcoat:0.6,clearcoatRoughness:0.25});
HM.energy=new THREE.MeshStandardMaterial({color:lin(0x9fe4ff),emissive:lin(0x6fd0ff),emissiveIntensity:1.3,roughness:0.3});
const soleM=M(0x1b1d22,0.6),mouthM=M(0x6b3a30,0.6);
const bmesh=(geo,mat,par,x,y,z,sx,sy,sz)=>{const m=hadd(geo,mat,par,x,y,z,sx,sy,sz);m.receiveShadow=true;return m;};
const SGH=()=>new THREE.SphereGeometry(1,16,12);
const hips=new THREE.Group();hips.position.y=0.95;rig.add(hips);
bmesh(latheG([[0.001,-0.13],[0.06,-0.125],[0.12,-0.1],[0.155,-0.05],[0.165,0.0],[0.16,0.05],[0.145,0.09]]),HM.suit,hips,0,0,0,1,1,0.74);
const spine=new THREE.Group();spine.position.y=0.06;hips.add(spine);
bmesh(latheG([[0.001,-0.03],[0.142,-0.02],[0.144,0.04],[0.14,0.1],[0.146,0.16],[0.16,0.22],[0.185,0.28],[0.212,0.34],[0.232,0.4],[0.236,0.46],[0.224,0.52],[0.18,0.57],[0.105,0.605],[0.058,0.62]],40),HM.suitT,spine,0,0,0,1.1,1,0.7);
bmesh(new THREE.SphereGeometry(1,24,14),HM.suit,spine,0,0.565,-0.01,0.19,0.065,0.1);
bmesh(new THREE.SphereGeometry(1,40,18,Math.PI/2-0.95,1.9,0.95,0.8),HM.armor,spine,0,0.42,0,0.262,0.17,0.174);
for(const [y,z] of[[0.14,0.112],[0.205,0.12],[0.27,0.134]])for(const x of[-0.036,0.036])bmesh(rbox(0.058,0.044,0.02,0.008),HM.armor,spine,x,y,z);
bmesh(latheG([[0.152,-0.008],[0.16,0.0],[0.16,0.055],[0.152,0.063]],40),HM.acc,spine,0,0,0,1.1,1,0.74);
bmesh(new THREE.SphereGeometry(1,20,12),HM.energy,spine,0,0.027,0.118,0.045,0.032,0.014);
bmesh(latheG([[0.058,0.55],[0.058,0.62],[0.062,0.69],[0.056,0.7]],24),HM.suit,spine,0,0,0,1,1,1);
bmesh(new THREE.CylinderGeometry(0.1,0.145,0.14,28,1,true,Math.PI/2,Math.PI),HM.cape,spine,0,0.585,-0.012,1,1,0.9);
const head=new THREE.Group();head.position.y=0.72;spine.add(head);
bmesh(new THREE.SphereGeometry(0.112,40,28),HM.skin,head,0,0.01,0,1,1.1,1.06);
bmesh(new THREE.SphereGeometry(0.088,28,18),HM.skin,head,0,-0.045,0.024,1,0.8,1);
bmesh(new THREE.SphereGeometry(1,16,12),HM.skin,head,0,-0.004,0.118,0.017,0.027,0.022);
const lipM=M(0xa65e4c,0.45);
for(const [g,m,x,y,z,sx,sy,sz] of[[SGH(),HM.skin,0,0.036,0.097,0.082,0.017,0.03],[SGH(),HM.skin,0.05,-0.012,0.092,0.03,0.021,0.024],[SGH(),HM.skin,-0.05,-0.012,0.092,0.03,0.021,0.024],[SGH(),HM.skin,0,0.016,0.111,0.011,0.03,0.014],[SGH(),HM.skin,0,-0.088,0.07,0.036,0.03,0.03],[SGH(),lipM,0,-0.051,0.104,0.026,0.0075,0.011],[SGH(),lipM,0,-0.061,0.101,0.023,0.008,0.011],[SGH(),HM.skin,0.024,-0.07,0.085,0.02,0.035,0.03],[SGH(),HM.skin,-0.024,-0.07,0.085,0.02,0.035,0.03]])bmesh(g,m,head,x,y,z,sx,sy,sz);
for(const s of[1,-1]){bmesh(new THREE.SphereGeometry(1,14,10),HM.skin,head,s*0.111,0.0,-0.004,0.013,0.03,0.021);const br=bmesh(new THREE.BoxGeometry(0.036,0.008,0.012),HM.hair,head,s*0.041,0.037,0.108);br.rotation.z=-s*0.12;}
bmesh(new THREE.BoxGeometry(0.03,0.004,0.006),mouthM,head,0,-0.0565,0.106);
bmesh(new THREE.SphereGeometry(0.119,40,20,0,Math.PI*2,0,1.32),HM.hair,head,0,0.016,-0.006,1.02,1.12,1.08);
{const q=bmesh(new THREE.SphereGeometry(1,20,14),HM.hair,head,0.018,0.118,0.055,0.062,0.034,0.05);q.rotation.set(-0.35,0,0.25);}
const maskMesh=bmesh(new THREE.SphereGeometry(0.1172,40,10,0,Math.PI*2,1.25,0.45),HM.mask,head,0,0.01,0,1.02,1.1,1.07);
const eyes=[hadd(sph(1),HM.eye,head,0.04,0.012,0.114,0.022,0.012,0.006),hadd(sph(1),HM.eye,head,-0.04,0.012,0.114,0.022,0.012,0.006)];
{const dia=new THREE.Shape();dia.moveTo(0,0.075);dia.lineTo(0.085,0);dia.lineTo(0,-0.075);dia.lineTo(-0.085,0);dia.lineTo(0,0.075);{const eg=new THREE.ExtrudeGeometry(dia,{depth:0.006,bevelEnabled:true,bevelThickness:0.005,bevelSize:0.005,bevelSegments:2,curveSegments:4});bmesh(eg,HM.acc,spine,0,0.4,0.168);bmesh(new THREE.TorusGeometry(0.098,0.0055,8,40),HM.energy,spine,0,0.4,0.176);}
 const st=new THREE.Shape();for(let i=0;i<10;i++){const r=i%2?0.017:0.04,a=Math.PI/2+i*Math.PI/5;if(i)st.lineTo(Math.cos(a)*r,Math.sin(a)*r);else st.moveTo(Math.cos(a)*r,Math.sin(a)*r);}{const sg=new THREE.ExtrudeGeometry(st,{depth:0.004,bevelEnabled:true,bevelThickness:0.003,bevelSize:0.002,bevelSegments:1});bmesh(sg,HM.energy,spine,0,0.4,0.182);}
 for(const s of[1,-1]){const pch=bmesh(rbox(0.05,0.045,0.035,0.012),HM.armor,spine,s*0.128,0.02,0.08);pch.rotation.y=s*0.55;}
 for(const s of[1,-1])bmesh(new THREE.SphereGeometry(0.024,16,12),HM.acc,spine,s*0.14,0.53,0.112);}
function harm(s){const sh=new THREE.Group();sh.position.set(s*0.278,0.5,0);spine.add(sh);
 bmesh(new THREE.SphereGeometry(0.092,28,20),HM.suit,sh,0,-0.005,0,1,0.95,0.92);
 bmesh(latheG([[0.001,-0.29],[0.053,-0.285],[0.058,-0.25],[0.065,-0.19],[0.074,-0.13],[0.077,-0.09],[0.074,-0.04],[0.069,0.0],[0.001,0.03]]),HM.suit,sh,0,0,0,1,1,0.92);
 const el=new THREE.Group();el.position.y=-0.28;sh.add(el);bmesh(new THREE.SphereGeometry(0.057,20,14),HM.suit,el,0,0,0);
 bmesh(latheG([[0.001,-0.25],[0.044,-0.245],[0.046,-0.2],[0.055,-0.12],[0.064,-0.07],[0.073,-0.04],[0.076,-0.02],[0.056,0.0],[0.001,0.02]]),HM.acc,el,0,0,0,1,1,0.9);
 for(const y of[-0.09,-0.15])bmesh(new THREE.TorusGeometry(0.06+(y<-0.12?-0.004:0),0.004,8,28).rotateX(Math.PI/2),HM.energy,el,0,y,0,1,1,0.92);
 const fist=bmesh(new THREE.SphereGeometry(1,20,14),HM.acc,el,0,-0.29,0.006,0.058,0.068,0.052);
 bmesh(new THREE.SphereGeometry(1,12,8),HM.acc,el,-s*0.03,-0.275,0.03,0.018,0.03,0.018);
 bmesh(new THREE.SphereGeometry(0.1,28,12,0,Math.PI*2,0,1.1),HM.acc,sh,0,0.006,0,1.04,0.9,0.98);bmesh(new THREE.SphereGeometry(0.104,28,8,0,Math.PI*2,1.0,0.32),HM.armor,sh,0,-0.012,0,1.04,0.9,0.98);bmesh(rbox(0.07,0.03,0.035,0.01),HM.acc,el,0,-0.29,0.048);
 return{sh,el,fist};}
function hleg(s){const th=new THREE.Group();th.position.set(s*0.104,-0.03,0);hips.add(th);
 bmesh(latheG([[0.001,-0.46],[0.059,-0.45],[0.067,-0.41],[0.08,-0.33],[0.093,-0.23],[0.102,-0.14],[0.103,-0.06],[0.097,0.0],[0.075,0.035],[0.001,0.05]]),HM.suit,th,0,0,0,1,1,0.95);
 const kn=new THREE.Group();kn.position.y=-0.44;th.add(kn);bmesh(new THREE.SphereGeometry(0.058,20,14),HM.suit,kn,0,0.005,0.008);
 bmesh(latheG([[0.001,-0.44],[0.05,-0.435],[0.048,-0.39],[0.054,-0.3],[0.064,-0.2],[0.068,-0.12],[0.066,-0.06],[0.074,-0.03],[0.077,-0.005],[0.001,0.01]]),HM.acc,kn,0,0,0,1,1,0.95);
 bmesh(new THREE.SphereGeometry(1,20,14),HM.acc,kn,0,-0.43,0.045,0.052,0.042,0.115);
 bmesh(new THREE.BoxGeometry(0.1,0.018,0.23),soleM,kn,0,-0.462,0.045);bmesh(rbox(0.088,0.04,0.075,0.012),soleM,kn,0,-0.452,-0.04);bmesh(new THREE.SphereGeometry(1,16,12),HM.acc,kn,0,-0.437,0.135,0.05,0.034,0.05);
 bmesh(new THREE.SphereGeometry(1,20,14),HM.acc,kn,0,0.012,0.048,0.062,0.07,0.042);bmesh(rbox(0.07,0.2,0.03,0.012),HM.armor,kn,0,-0.16,0.064);
 for(const y of[-0.16,-0.3])bmesh(new THREE.TorusGeometry(0.066+(y<-0.2?-0.005:0),0.007,8,28).rotateX(Math.PI/2),soleM,kn,0,y,0,1,1,0.95);
 return{th,kn};}
const AL=harm(1),AR=harm(-1),LL=hleg(1),LR=hleg(-1);
{const interp=(pts,y)=>{for(let i=1;i<pts.length;i++){if(y<=pts[i][1]){const a=pts[i-1],b=pts[i],t=(y-a[1])/((b[1]-a[1])||1);return a[0]+(b[0]-a[0])*t;}}return pts[pts.length-1][0];};
 const pipe=(par,pts,sx,sz,x0,y0,y1,side,n)=>{const v=[];for(let i=0;i<=n;i++){const y=y0+(y1-y0)*i/n;v.push(new V3(side*(interp(pts,y)*sx+0.0035)+x0,y,0));}const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v),n*3,0.0042,6,false);bmesh(g,HM.energy,par,0,0,0);};
 const TOR=[[0.142,-0.02],[0.144,0.04],[0.14,0.1],[0.146,0.16],[0.16,0.22],[0.185,0.28],[0.212,0.34],[0.232,0.4],[0.236,0.46],[0.224,0.52]];
 const ARM=[[0.053,-0.285],[0.058,-0.25],[0.065,-0.19],[0.074,-0.13],[0.077,-0.09],[0.074,-0.04],[0.069,0.0]];
 const LEG=[[0.059,-0.45],[0.067,-0.41],[0.08,-0.33],[0.093,-0.23],[0.102,-0.14],[0.103,-0.06],[0.097,0.0]];
 for(const s of[1,-1]){pipe(spine,TOR,1.1,0.7,0,0.06,0.5,s,10);pipe(s>0?AL.sh:AR.sh,ARM,1,0.92,0,-0.27,-0.02,s,8);pipe(s>0?LL.th:LR.th,LEG,1,0.95,0,-0.43,-0.03,s,8);}
 for(const[x,y,z,sx,sy,sz,rx,rz]of[[0.03,0.135,0.05,0.05,0.026,0.07,-0.5,0.3],[-0.035,0.13,0.06,0.048,0.024,0.065,-0.6,-0.35],[0,0.14,0.0,0.06,0.025,0.08,0.2,0],[0.06,0.11,-0.02,0.04,0.03,0.07,0.1,0.6],[-0.06,0.11,-0.02,0.04,0.03,0.07,0.1,-0.6]]){const c=bmesh(new THREE.SphereGeometry(1,16,10),HM.hair,head,x,y,z,sx,sy,sz);c.rotation.set(rx,0,rz);}
 for(const A of[AL,AR])for(let k=0;k<4;k++){const x=-0.03+k*0.02;bmesh(new THREE.SphereGeometry(0.0125,10,8),HM.acc,A.el,x,-0.31,0.045);const f1=bmesh(new THREE.CylinderGeometry(0.0115,0.0115,0.024,8),HM.acc,A.el,x,-0.328,0.05);f1.rotation.x=Math.PI/2;const f2=bmesh(new THREE.CylinderGeometry(0.011,0.011,0.022,8),HM.acc,A.el,x,-0.345,0.034);f2.rotation.x=0.3;}}
const irisM=M(0x3a2a1c,0.3),scleraM=M(0xf2efe8,0.35);const plainEyes=[];for(const x of[0.04,-0.04]){const w=hadd(sph(1),scleraM,head,x,0.014,0.112,0.017,0.011,0.007);const ir=hadd(sph(1),irisM,head,x,0.014,0.118,0.0075,0.0075,0.003);w.visible=ir.visible=false;plainEyes.push(w,ir);}
const COS_DEF={suit:'#1f4fa8',acc:'#e8b923',cape:'#c62a34',mask:'#121a2e',hair:'#241a14',capeOn:true,maskOn:true,energy:'#6fd0ff',civShirt:'#e9e6df',civPants:'#2b3a55',civShoe:'#f2f2f2'};
let civOn=false;
const cottonN=normalMapFrom(mkc(128,128,(g,w,h)=>{noise(g,w,h,'#c8c8c8',0.25);}),1.2);cottonN.repeat.set(4,4);
const denimN=normalMapFrom(mkc(128,128,(g,w,h)=>{g.fillStyle='#c8c8c8';g.fillRect(0,0,w,h);g.strokeStyle='#8a8a8a';g.lineWidth=1.2;for(let i=-h;i<w;i+=4){g.beginPath();g.moveTo(i,0);g.lineTo(i+h,h);g.stroke();}}),1.6);denimN.repeat.set(3,3);
HM.civShirt=M(0xe9e6df,0.88,{normalMap:cottonN,normalScale:new THREE.Vector2(0.5,0.5)});HM.civPants=M(0x2b3a55,0.82,{normalMap:denimN,normalScale:new THREE.Vector2(0.7,0.7)});HM.civShoe=M(0xf2f2f2,0.55);HM.civBelt=M(0x3a2616,0.55);HM.civSole=M(0xdedad2,0.7);
const civSwap=[];
rig.traverse(o=>{if(!o.isMesh)return;const m=o.material,par=o.parent,gt=o.geometry.type;let c=null;
 const arm=par===AL.sh||par===AR.sh,fore=par===AL.el||par===AR.el,thigh=par===LL.th||par===LR.th,shin=par===LL.kn||par===LR.kn;
 if(m===HM.suitT)c='shirt';
 else if(m===HM.suit)c=arm?'shirt':fore?'skin':(thigh||shin||par===hips)?'pants':par===spine?'skin':null;
 else if(m===HM.acc)c=fore?(gt==='ExtrudeGeometry'?'hide':'skin'):shin?(gt==='LatheGeometry'?'pants':o.position.y>-0.2?'hide':'shoe'):(arm||thigh)?'hide':par===spine?(gt==='LatheGeometry'?'belt':'hide'):null;
 else if(m===soleM)c=gt==='TorusGeometry'?'hide':'sole';
 else if(m===HM.cape||m===HM.star||m===HM.energy||m===HM.armor)c='hide';
 if(c)civSwap.push({o,orig:m,c});});
function setCivilian(on){civOn=on;if(typeof updateHeroExtras==='function')setTimeout(updateHeroExtras,0);const MAT={shirt:HM.civShirt,pants:HM.civPants,skin:HM.skin,shoe:HM.civShoe,belt:HM.civBelt,sole:HM.civSole};
 for(const q of civSwap){if(on){if(q.c==='hide')q.o.visible=false;else{q.o.material=MAT[q.c];q.o.visible=true;}}else{q.o.material=q.orig;q.o.visible=true;}}
 applyCostume();document.querySelectorAll('.slot .n').forEach((n,i)=>n.setAttribute('data-lock',on?'Sivil kılıktasın':(i===3?"Seviye 2'de açılır":'')));}
const PRESETS=[['Gök Muhafızı',COS_DEF],['Gece Gölgesi',{suit:'#1b1d24',acc:'#6b6f78',cape:'#2a1f3d',mask:'#0d0e12',hair:'#0f0f12',capeOn:true,maskOn:true}],['Alev',{suit:'#b3261e',acc:'#f2a31b',cape:'#e8631a',mask:'#3a0e0a',hair:'#5a2412',capeOn:true,maskOn:true}],['Zümrüt',{suit:'#1f6b4a',acc:'#c9ccd2',cape:'#0f3d2c',mask:'#123326',hair:'#241a14',capeOn:false,maskOn:true}],['Buzul',{suit:'#e9eef4',acc:'#6fb6e8',cape:'#2d6fb0',mask:'#2d6fb0',hair:'#d9d2c0',capeOn:true,maskOn:false}],['Güneş',{suit:'#f2efe8',acc:'#e8b923',cape:'#c62a34',mask:'#c62a34',hair:'#7a4a22',capeOn:true,maskOn:true}]];
const costume=Object.assign({},COS_DEF);
function applyCostume(){HM.suit.color.copy(lin(costume.suit));HM.suitT.color.copy(lin(costume.suit));HM.armor.color.copy(lin(costume.suit)).multiplyScalar(0.42);const ec=lin(costume.energy||'#6fd0ff');HM.energy.color.copy(ec).lerp(new THREE.Color(1,1,1),0.35);HM.energy.emissive.copy(ec);HM.eye.emissive.copy(ec).lerp(new THREE.Color(1,1,1),0.4);HM.eye.emissiveIntensity=1.4;HM.acc.color.copy(lin(costume.acc));HM.cape.color.copy(lin(costume.cape));HM.mask.color.copy(lin(costume.mask));HM.hair.color.copy(lin(costume.hair));cape.visible=costume.capeOn;maskMesh.visible=costume.maskOn;eyes.forEach(e=>e.visible=costume.maskOn);plainEyes.forEach(e=>e.visible=!costume.maskOn);HM.civShirt.color.copy(lin(costume.civShirt));HM.civPants.color.copy(lin(costume.civPants));HM.civShoe.color.copy(lin(costume.civShoe));
 if(civOn){cape.visible=false;maskMesh.visible=false;eyes.forEach(e=>e.visible=false);plainEyes.forEach(e=>e.visible=true);for(const q of civSwap)if(q.c==='hide')q.o.visible=false;}}
const capeP=new THREE.Group();capeP.position.set(0,0.565,-0.15);spine.add(capeP);
HM.cape.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nif(!gl_FrontFacing)diffuseColor.rgb*=0.55;');};HM.cape.customProgramCacheKey=()=>'capelining';
const capeG=new THREE.PlaneGeometry(1,1,10,20),cpos=capeG.attributes.position,capeBase=[];
for(let i=0;i<cpos.count;i++)capeBase.push([cpos.getX(i)+0.5,0.5-cpos.getY(i)]);
const cape=new THREE.Mesh(capeG,HM.cape);cape.castShadow=true;capeP.add(cape);
function updCape(amp,t){for(let i=0;i<cpos.count;i++){const u=capeBase[i][0],v=capeBase[i][1],wd=0.5+0.6*v;cpos.setXYZ(i,(u-0.5)*wd+Math.sin(t*5+v*4)*0.01*v,-v*1.32,-Math.sin(t*7-v*6+u*2)*amp*v-0.03*v*v-Math.abs(Math.sin(u*Math.PI*5))*0.022*v-Math.sin(u*Math.PI)*0.03*(1-v));}cpos.needsUpdate=true;capeG.computeVertexNormals();}

/* ---------- effects ---------- */
const softTex=cv(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(0.45,'rgba(255,255,255,.6)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
const PS_VS='attribute float size;attribute float alpha;attribute vec3 pcol;uniform float scale;varying float vA;varying vec3 vC;void main(){vA=alpha;vC=pcol;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=size*scale/max(0.1,-mv.z);gl_Position=projectionMatrix*mv;}';
const PS_FS='uniform sampler2D map;uniform float lin;varying float vA;varying vec3 vC;void main(){vec4 t=texture2D(map,gl_PointCoord);float a=t.a*vA;if(a<0.01)discard;gl_FragColor=vec4(mix(vC,pow(vC,vec3(2.2)),lin),a);}';
function makePS(max,blending){const g=new THREE.BufferGeometry();const a={pos:new Float32Array(max*3),col:new Float32Array(max*3),size:new Float32Array(max),alpha:new Float32Array(max)};
 g.setAttribute('position',new THREE.BufferAttribute(a.pos,3));g.setAttribute('pcol',new THREE.BufferAttribute(a.col,3));g.setAttribute('size',new THREE.BufferAttribute(a.size,1));g.setAttribute('alpha',new THREE.BufferAttribute(a.alpha,1));
 const mat=new THREE.ShaderMaterial({uniforms:{map:{value:softTex},scale:{value:500},lin:{value:0}},vertexShader:PS_VS,fragmentShader:PS_FS,transparent:true,depthWrite:false,blending});
 const pts=new THREE.Points(g,mat);pts.frustumCulled=false;scene.add(pts);const P=[];for(let i=0;i<max;i++)P.push({life:0,max:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,s0:1,s1:1,r:1,g:1,b:1,a:1,drag:0,grav:0});return{g,a,P,max,idx:0,mat};}
const dustPS=makePS(2200,THREE.NormalBlending),glowPS=makePS(1600,THREE.AdditiveBlending);
function emit(ps,x,y,z,vx,vy,vz,life,s0,s1,r,g,b,a,drag,grav){const p=ps.P[ps.idx];ps.idx=(ps.idx+1)%ps.max;p.life=p.max=life;p.x=x;p.y=y;p.z=z;p.vx=vx;p.vy=vy;p.vz=vz;p.s0=s0;p.s1=s1;p.r=r;p.g=g;p.b=b;p.a=a;p.drag=drag;p.grav=grav;}
function updatePS(ps,dt){const A=ps.a;for(let i=0;i<ps.max;i++){const p=ps.P[i];if(p.life<=0){A.alpha[i]=0;continue;}p.life-=dt;const k=1-Math.max(0,p.life)/p.max;const dr=Math.max(0,1-p.drag*dt);p.vx*=dr;p.vy=p.vy*dr+p.grav*dt;p.vz*=dr;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<0.1){p.y=0.1;p.vy=0;}
 const i3=i*3;A.pos[i3]=p.x;A.pos[i3+1]=p.y;A.pos[i3+2]=p.z;A.col[i3]=p.r;A.col[i3+1]=p.g;A.col[i3+2]=p.b;A.size[i]=p.s0+(p.s1-p.s0)*k;A.alpha[i]=p.life>0?p.a*Math.min(1,k*8)*(1-k):0;}
 for(const n of['position','pcol','size','alpha'])ps.g.attributes[n].needsUpdate=true;}
function randDir(){const u=rand(-1,1),a=rand(0,6.283),s=Math.sqrt(1-u*u);return _v3.set(s*Math.cos(a),u,s*Math.sin(a));}
function dustBurst(p,n,spread,up,s0,s1,life,col){col=col||[0.62,0.58,0.52];for(let i=0;i<n;i++){const a=rand(0,6.283),sp=rand(0.3,1)*spread,sh=rand(0.85,1.1);emit(dustPS,p.x+rand(-1,1),p.y+rand(-0.3,1),p.z+rand(-1,1),Math.cos(a)*sp,rand(0.2,1)*up,Math.sin(a)*sp,life*rand(0.7,1.3),s0,s1,col[0]*sh,col[1]*sh,col[2]*sh,0.72,1.3,0.4);}}
function fireBurst(p,n,speed,sc){sc=sc||1;for(let i=0;i<n;i++){const d=randDir(),sp=rand(0.3,1)*speed,hot=Math.random();emit(glowPS,p.x,p.y,p.z,d.x*sp,d.y*sp,d.z*sp,rand(0.3,0.8),rand(1.5,3)*sc,rand(3,6)*sc,1,0.4+0.45*hot,0.1*hot,1,2.5,2);}}
function sparks(p,n,speed,c){c=c||[1,0.8,0.4];for(let i=0;i<n;i++){const d=randDir(),sp=rand(0.4,1)*speed;emit(glowPS,p.x,p.y,p.z,d.x*sp,d.y*sp,d.z*sp,rand(0.2,0.5),0.45,0.12,c[0],c[1],c[2],1,1,-18);}}
let flashI=0;function flashAt(p,i){flash.position.copy(p);flashI=Math.max(flashI,i);}
let trauma=0;function addShake(a){trauma=Math.min(1,trauma+a);}
function addShakeAt(p,a){addShake(a*clamp(1-p.distanceTo(camera.position)/320,0,1));}
let hitStop=0;
/* debris */
const DEB=520;const debMesh=new THREE.InstancedMesh(boxGeo,M(0xffffff,0.9),DEB);debMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);debMesh.castShadow=true;debMesh.frustumCulled=false;scene.add(debMesh);
const debris=[];let debIdx=0;const debCol=new THREE.Color();
for(let i=0;i<DEB;i++){debris.push({life:0,p:new V3(),v:new V3(),r:new V3(),av:new V3(),s:1});dm.position.set(0,-50,0);dm.rotation.set(0,0,0);dm.scale.set(0,0,0);dm.updateMatrix();debMesh.setMatrixAt(i,dm.matrix);debMesh.setColorAt(i,debCol.set(0x999999));}
function spawnDebris(pt,n,speed,smin,smax,color,upBias){upBias=upBias==null?0.6:upBias;for(let k=0;k<n;k++){const i=debIdx,d=debris[i];debIdx=(debIdx+1)%DEB;const dir=randDir();d.p.copy(pt);d.v.set(dir.x*speed*rand(0.3,1),Math.abs(dir.y)*speed*rand(0.3,1)*upBias+speed*0.2,dir.z*speed*rand(0.3,1));d.r.set(rand(0,6),rand(0,6),rand(0,6));d.av.set(rand(-8,8),rand(-8,8),rand(-8,8));d.s=rand(smin,smax);d.life=rand(4,7);debCol.set(color).offsetHSL(0,0,rand(-0.08,0.08)).convertSRGBToLinear();debMesh.setColorAt(i,debCol);}debMesh.instanceColor.needsUpdate=true;}
function updateDebris(dt){for(let i=0;i<DEB;i++){const d=debris[i];if(d.life<=0)continue;d.life-=dt;d.v.y-=30*dt;d.p.addScaledVector(d.v,dt);d.r.addScaledVector(d.av,dt);const half=d.s*0.5;if(d.p.y<half){d.p.y=half;if(d.v.y<0)d.v.y*=-0.25;d.v.x*=0.6;d.v.z*=0.6;d.av.multiplyScalar(0.6);}
 const sc=d.life<=0?0:(d.life<1?d.s*d.life:d.s);dm.position.copy(d.p);dm.rotation.set(d.r.x,d.r.y,d.r.z);dm.scale.set(sc,sc,sc);dm.updateMatrix();debMesh.setMatrixAt(i,dm.matrix);}debMesh.instanceMatrix.needsUpdate=true;}
/* expanding rings */
const ringGeo=new THREE.TorusGeometry(1,0.08,8,48),fxRings=[];
function ringFx(pos,normal,maxR,life,color){const m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:lin(color),transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false}));m.position.copy(pos);m.quaternion.setFromUnitVectors(new V3(0,0,1),normal.clone().normalize());scene.add(m);fxRings.push({m,t:0,life,maxR});}
function updateRings(dt){for(let i=fxRings.length-1;i>=0;i--){const r=fxRings[i];r.t+=dt;const k=Math.min(1,r.t/r.life);const s=r.maxR*(1-Math.pow(1-k,3))+0.1;r.m.scale.set(s,s,1+s*0.2);r.m.material.opacity=0.9*(1-k);if(k>=1){scene.remove(r.m);r.m.material.dispose();fxRings.splice(i,1);}}}

/* ---------- space: leave the atmosphere and look down at Earth ---------- */
const RE=6371000,SPACE_Y=1200,EARTH_R=300;
function fbmTex(w,h,draw){return cv(w,h,draw);}
const spaceScene=new THREE.Scene(),spaceCam=new THREE.PerspectiveCamera(60,1,0.5,6000),spaceSun=new THREE.DirectionalLight(0xffffff,2.4);spaceScene.add(spaceSun,new THREE.AmbientLight(0x1a2433,0.35));
const spaceSky=new THREE.Mesh(sky.geometry,sky.material);spaceSky.scale.setScalar(1000/1300);spaceSky.frustumCulled=false;spaceSky.renderOrder=-1;spaceScene.add(spaceSky);
const earthGroup=new THREE.Group();spaceScene.add(earthGroup);const FOG_BASE=new THREE.Color(0xcfdde9);let HEMI_BASE=1.05,SPACE_ON=false;
{const P=[];for(let i=0;i<64;i++)P.push([rand(0,1),rand(0.12,0.88),rand(0.03,0.12),rand(0.35,1)]);
 const hgt=(u,v)=>{let s=0;for(const [cu,cv2,r,a] of P){let du=Math.abs(u-cu);du=Math.min(du,1-du);const dv=v-cv2,d=Math.sqrt(du*du*4+dv*dv)/r;if(d<1.6)s+=a*Math.exp(-d*d*1.6);}return s+0.18*Math.sin(u*41+v*17)*Math.sin(u*23-v*31);};
 const T=fbmTex(512,256,(g,w,h)=>{const img=g.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h,e=hgt(u,v),lat=Math.abs(v-0.5)*2;let r,gg,b;
  if(lat>0.86){r=235;gg=240;b=245;}else if(e<0.55){const dp=clamp((0.55-e)*1.6,0,1);r=18+20*(1-dp);gg=52+40*(1-dp);b=100+40*(1-dp);}else{const m=clamp((e-0.55)*1.2,0,1),dry=clamp(0.5-Math.abs(lat-0.42)*2.2,0,1);r=lerp(60,150,m*0.6+dry*0.6);gg=lerp(105,125,m*0.3)-dry*20;b=lerp(55,80,m);if(lat>0.72){r=lerp(r,230,(lat-0.72)*5);gg=lerp(gg,235,(lat-0.72)*5);b=lerp(b,240,(lat-0.72)*5);}}
  const i=(y*w+x)*4;img.data[i]=r;img.data[i+1]=gg;img.data[i+2]=b;img.data[i+3]=255;}g.putImageData(img,0,0);});
 const CT=cv(512,256,(g,w,h)=>{g.clearRect(0,0,w,h);for(let i=0;i<420;i++){const x=rand(0,w),y=rand(h*0.08,h*0.92),r=rand(6,30);const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,'+rand(0.25,0.6).toFixed(2)+')');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.ellipse(x,y,r*2.2,r*0.8,rand(-0.2,0.2),0,6.3);g.fill();}});
 const earth=new THREE.Mesh(new THREE.SphereGeometry(EARTH_R,96,64),new THREE.MeshStandardMaterial({map:T,roughness:0.85,metalness:0,transparent:true,fog:false}));
 const clouds=new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*1.006,96,64),new THREE.MeshStandardMaterial({map:CT,transparent:true,depthWrite:false,roughness:1,fog:false}));
 const atmo=new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*1.045,64,48),new THREE.ShaderMaterial({uniforms:{op:{value:1},lin:{value:0}},vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 wp=modelMatrix*vec4(position,1.0);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}',
  fragmentShader:'uniform float op;uniform float lin;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.0-abs(dot(vN,vV)),3.0);vec3 c=vec3(0.35,0.62,1.0);c=mix(c,pow(c,vec3(2.2)),lin);gl_FragColor=vec4(c*f*1.6*op,1.0);}',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.BackSide,fog:false}));
 earthGroup.add(earth,clouds,atmo);earthGroup.userData={earth,clouds,atmo};}
let spaceK=0,realAlt=0;
function updateSpace(dt){const y=Math.max(pl.pos.y,camera.position.y*0.7);realAlt=y<SPACE_Y?Math.max(0,y):SPACE_Y+(y-SPACE_Y)*60;const k=clamp((y-700)/2300,0,1);spaceK=k*k*(3-2*k);SPACE_ON=spaceK>0.02;
 for(const m of[sky.material,envSky.material])if(m.uniforms.space)m.uniforms.space.value=spaceK;
 
 if(SPACE_ON){const ud=earthGroup.userData,D=EARTH_R*(1+realAlt/RE);earthGroup.position.set(0,-D,0);ud.clouds.rotation.y+=dt*0.004;earthGroup.rotation.set(pl.pos.z*0.00002,pl.pos.x*0.00002+time*0.0015,0);
  const op=clamp((spaceK-0.12)/0.45,0,1);ud.earth.material.opacity=op;ud.clouds.material.opacity=op*0.9;ud.atmo.material.uniforms.op.value=op;
  spaceCam.position.set(0,0,0);spaceCam.quaternion.copy(camera.quaternion);spaceCam.fov=camera.fov;spaceCam.aspect=camera.aspect;spaceCam.updateProjectionMatrix();spaceSun.position.copy(SUN_DIR).multiplyScalar(100);}
 if(y>SPACE_Y&&!pl.flying&&!pl.dead&&state==='play')startFly();}
function drawScene(){if(SPACE_ON){sky.visible=false;renderer.render(spaceScene,spaceCam);const ac=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(scene,camera);renderer.autoClear=ac;sky.visible=true;}else renderer.render(scene,camera);}

const _SC1=scene.children.length;
/* ---------- GPU crowd: thousands of distant pedestrians, animated entirely on the graphics card ---------- */
const CROWD_N=IS_MOBILE?7000:18200;
const crowd=(()=>{const geos=[];const addP=(g,part)=>{g=g.index?g.toNonIndexed():g;const n=g.attributes.position.count;geos.push({g,part,n});};
 for(const s of[-1,1]){addP(new THREE.CylinderGeometry(0.078,0.06,0.8,6).translate(s*0.09,0.48,0),2);addP(new THREE.BoxGeometry(0.11,0.08,0.25).translate(s*0.09,0.04,0.04),4);addP(new THREE.CylinderGeometry(0.052,0.042,0.6,5).translate(s*0.215,1.13,0),1);addP(new THREE.SphereGeometry(0.046,5,4).translate(s*0.215,0.8,0.01),0);}
 addP(new THREE.CylinderGeometry(0.175,0.15,0.6,8).scale(1,1,0.66).translate(0,1.15,0),1);addP(new THREE.SphereGeometry(0.16,8,4,0,Math.PI*2,Math.PI/2,Math.PI/2).scale(1,0.5,0.7).translate(0,0.88,0),2);
 addP(new THREE.CylinderGeometry(0.05,0.056,0.1,6).translate(0,1.48,0),0);addP(new THREE.SphereGeometry(0.105,8,6).scale(1,1.12,1.04).translate(0,1.6,0),0);addP(new THREE.SphereGeometry(0.113,8,4,0,Math.PI*2,0,1.55).scale(1,1.1,1.07).translate(0,1.62,-0.01),3);
 let tot=0;for(const q of geos)tot+=q.n;const pos=new Float32Array(tot*3),nor=new Float32Array(tot*3),prt=new Float32Array(tot);let o=0;
 for(const q of geos){pos.set(q.g.attributes.position.array,o*3);nor.set(q.g.attributes.normal.array,o*3);prt.fill(q.part,o,o+q.n);o+=q.n;}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));geo.setAttribute('part',new THREE.BufferAttribute(prt,1));
 const blocks=[],outerB=[],NBc=Math.ceil((OUT_R-HALF)/PITCH)+1;
 for(let bi=-NBc;bi<N+NBc;bi++)for(let bj=-NBc;bj<N+NBc;bj++){if(bj===RJ)continue;const x0=-HALF+ROAD/2+bi*PITCH,z0=-HALF+ROAD/2+bj*PITCH;const inCity=bi>=0&&bi<N&&bj>=0&&bj<N;if(inCity){if(!(bi===CI&&bj===CI))blocks.push([x0,z0]);}else if(Math.hypot(x0+BLOCK/2,z0+BLOCK/2)<OUT_R-40)outerB.push([x0,z0]);}
 const route=new Float32Array(CROWD_N*4),move=new Float32Array(CROWD_N*4),cS=new Float32Array(CROWD_N*3),cT=new Float32Array(CROWD_N*3),cP=new Float32Array(CROWD_N*3);
 const SK=[0xf1d3bd,0xe0b394,0xc68e6a,0x9c6b4a,0x6f4a32,0xf3dcc8,0xd9a77f],TOP=[0x1b1d22,0xf2f2ee,0x2a4a6a,0x7a1f2b,0x3a5a3a,0xc9b48f,0x5a6b7a,0x8a2f5a,0xd8a028,0x2f6fd0,0x9aa3ad,0x4a3a2a,0xe4572e,0x6a8caf],PNT=[0x1d2633,0x2a2a2e,0x3b4f6b,0x5a4a3a,0x8a8f96,0x2f3b2a,0xbfb39a,0x4a4f58];
 const c=new THREE.Color();
 for(let i=0;i<CROWD_N;i++){const B=Math.random()<0.8||!outerB.length?pick(blocks):pick(outerB),inset=rand(1.2,2.1),S=BLOCK-2*inset;route.set([B[0],B[1],S,inset],i*4);
  const sp=rand(1.0,1.6)*(Math.random()<0.5?1:-1),sc=Math.random()<0.08?rand(0.6,0.72):rand(0.92,1.08);move.set([rand(0,4*S),sp,rand(0,6.28),sc],i*4);
  c.setHex(pick(SK)).convertSRGBToLinear();cS.set([c.r,c.g,c.b],i*3);c.setHex(pick(TOP)).convertSRGBToLinear();cT.set([c.r,c.g,c.b],i*3);c.setHex(Math.random()<0.15?pick(SK):pick(PNT)).convertSRGBToLinear();cP.set([c.r,c.g,c.b],i*3);}
 geo.setAttribute('aRoute',new THREE.InstancedBufferAttribute(route,4));geo.setAttribute('aMove',new THREE.InstancedBufferAttribute(move,4));geo.setAttribute('aSkin',new THREE.InstancedBufferAttribute(cS,3));geo.setAttribute('aTop',new THREE.InstancedBufferAttribute(cT,3));geo.setAttribute('aPants',new THREE.InstancedBufferAttribute(cP,3));
 const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.85});const U={uTime:{value:0},uCam:{value:new V3()},uHide:{value:118},uWaveO:{value:new THREE.Vector2()},uWaveR:{value:0},uWaveM:{value:0}};
 mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float part;attribute vec4 aRoute;attribute vec4 aMove;attribute vec3 aSkin;attribute vec3 aTop;attribute vec3 aPants;uniform float uTime;uniform vec3 uCam;uniform float uHide;uniform vec2 uWaveO;uniform float uWaveR;uniform float uWaveM;varying vec3 vCol;')
  .replace('#include <beginnormal_vertex>',`
   float S=aRoute.z,w=aRoute.w,L4=4.0*S,sp=aMove.y,s=mod(aMove.x+sp*uTime,L4),sd=floor(s/S),t=s-sd*S;vec2 P,H;
   if(sd<0.5){P=vec2(aRoute.x+w+t,aRoute.y+w);H=vec2(1.0,0.0);}else if(sd<1.5){P=vec2(aRoute.x+w+S,aRoute.y+w+t);H=vec2(0.0,1.0);}else if(sd<2.5){P=vec2(aRoute.x+w+S-t,aRoute.y+w+S);H=vec2(-1.0,0.0);}else{P=vec2(aRoute.x+w,aRoute.y+w+S-t);H=vec2(0.0,-1.0);}
   H*=sign(sp);float yaw=atan(H.x,H.y),cy=cos(yaw),sy=sin(yaw);
   float ph=aMove.z+uTime*6.2*abs(sp)/1.35,sw=sin(ph);vec3 lp=position;vec3 ln=normal;
   if((part>1.5&&part<2.5&&lp.y<0.86)||part>3.5){float a=sw*0.42*sign(lp.x);float yy=lp.y-0.86;float ca=cos(a),sa=sin(a);lp=vec3(lp.x,0.86+yy*ca-lp.z*sa,yy*sa+lp.z*ca);ln=vec3(ln.x,ln.y*ca-ln.z*sa,ln.y*sa+ln.z*ca);}
   else if(abs(lp.x)>0.18&&lp.y<1.45&&lp.y>0.7){float a=-sw*0.38*sign(lp.x);float yy=lp.y-1.42;float ca=cos(a),sa=sin(a);lp=vec3(lp.x,1.42+yy*ca-lp.z*sa,yy*sa+lp.z*ca);}
   lp.y+=abs(cos(ph))*0.028;
   float dc=length(P-uCam.xz);float vis=smoothstep(uHide,uHide+16.0,dc);float dw=length(P-uWaveO);if(uWaveM>0.5&&uWaveM<1.5)vis*=step(uWaveR,dw);else if(uWaveM>1.5)vis*=1.0-step(uWaveR,dw);float sc=aMove.w*vis;
   vec3 objectNormal=vec3(ln.x*cy+ln.z*sy,ln.y,-ln.x*sy+ln.z*cy);
   #ifdef USE_TANGENT
   vec3 objectTangent=vec3(1.0,0.0,0.0);
   #endif
   vCol=part<0.5?aSkin:part<1.5?aTop:part<2.5?aPants:part<3.5?vec3(0.03,0.022,0.018):vec3(0.02);`)
  .replace('#include <begin_vertex>','vec3 transformed=vec3(lp.x*cy+lp.z*sy,lp.y,-lp.x*sy+lp.z*cy)*sc+vec3(P.x,0.15,P.y);');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCol;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=vCol;');};
 mat.customProgramCacheKey=()=>'gpu-crowd';
 const mesh=new THREE.InstancedMesh(geo,mat,CROWD_N);const I=new THREE.Matrix4();for(let i=0;i<CROWD_N;i++)mesh.setMatrixAt(i,I);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;scene.add(mesh);
 return {mesh,U};})();
function updateCrowd(){crowd.U.uTime.value=WT;crowd.U.uCam.value.copy(camera.position);crowd.mesh.visible=CROWD_ON&&!ARENA&&(!SPACE_ON||spaceK<0.6);}

/* ---------- traffic signals at every intersection ---------- */
const SIG_CYCLE=28;
function sigState(ax){const t=time%SIG_CYCLE;if(ax===0)return t<11?0:t<14?1:2;return t<15?2:t<25?0:1;}
const SIG={lastKey:'',lamps:null,faces:[]};
{const poles=[],heads=[],lamps=[];const off=ROAD/2+1.4;
 for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){const X=-HALF+i*PITCH,Z=-HALF+j*PITCH;for(const sx of[-1,1])for(const sz of[-1,1]){const px=X+sx*off,pz=Z+sz*off;poles.push([px,pz]);
  heads.push([px,pz,0]);heads.push([px,pz,1]);
  for(const f of[-1,1])for(let k=0;k<3;k++){lamps.push({x:px+f*0.2,z:pz,y:4.15-k*0.32,ax:0,k});lamps.push({x:px,z:pz+f*0.2,y:4.15-k*0.32,ax:1,k});}}}
 const pm=M(0x2a2d31,0.5,{metalness:0.6});
 const poleI=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07,0.09,4.6,8).translate(0,2.3,0),pm,poles.length);poles.forEach((p,i)=>{dm.position.set(p[0],0.15,p[1]);dm.rotation.set(0,0,0);dm.scale.set(1,1,1);dm.updateMatrix();poleI.setMatrixAt(i,dm.matrix);});
 const headI=new THREE.InstancedMesh(boxGeo,M(0x1b1d20,0.6),heads.length);heads.forEach((h,i)=>{dm.position.set(h[0],3.83,h[1]);dm.scale.set(h[2]?0.3:0.36,1.05,h[2]?0.36:0.3);dm.updateMatrix();headI.setMatrixAt(i,dm.matrix);});
 const lampI=new THREE.InstancedMesh(new THREE.BoxGeometry(0.17,0.17,0.17),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:true}),lamps.length);
 lamps.forEach((l,i)=>{dm.position.set(l.x,l.y+0.15,l.z);dm.scale.set(1,1,1);dm.updateMatrix();lampI.setMatrixAt(i,dm.matrix);lampI.setColorAt(i,new THREE.Color(0,0,0));});
 for(const m of[poleI,headI]){m.castShadow=true;m.receiveShadow=true;}poleI.frustumCulled=headI.frustumCulled=lampI.frustumCulled=false;scene.add(poleI,headI,lampI);SIG.lamps=lampI;SIG.list=lamps;}
const SIG_ON=[new THREE.Color(2.2,0.08,0.04),new THREE.Color(2.2,1.2,0.05),new THREE.Color(0.1,2.0,0.6)],SIG_OFF=[new THREE.Color(0.09,0.02,0.02),new THREE.Color(0.09,0.07,0.02),new THREE.Color(0.02,0.08,0.04)];
function updateSignals(){const a=sigState(0),b=sigState(1),key=a+','+b;if(key===SIG.lastKey)return;SIG.lastKey=key;
 SIG.list.forEach((l,i)=>{const st=l.ax===0?a:b;const lit=(st===2&&l.k===0)||(st===1&&l.k===1)||(st===0&&l.k===2);SIG.lamps.setColorAt(i,lit?SIG_ON[l.k]:SIG_OFF[l.k]);});SIG.lamps.instanceColor.needsUpdate=true;}
let laneSortT=0;
function sortLanes(dt){laneSortT-=dt;if(laneSortT>0)return;laneSortT=0.25;const groups=new Map();for(const c of cars){if(!c.moving||c.state!==0){c.ahead=null;continue;}let g=groups.get(c.lane);if(!g){g=[];groups.set(c.lane,g);}g.push(c);}
 for(const [ln,g] of groups){g.sort((p,q)=>(p.along-q.along)*ln.dir);for(let k=0;k<g.length;k++)g[k].ahead=g.length>1?g[(k+1)%g.length]:null;}}
function carTargetSpeed(c){if(c.cruise==null)c.cruise=c.speed;let vt=c.cruise;const dir=c.lane.dir,a=c.along,st=sigState(c.lane.ax);
 if(st>0){const rel=(a+HALF)/PITCH;const j=dir>0?Math.ceil(rel+1e-4):Math.floor(rel-1e-4);if(j>=0&&j<=N){const stopL=-HALF+j*PITCH-dir*(ROAD/2+3.2);const d=(stopL-a)*dir;if(d>-0.5&&d<50&&(st===2||d>7))vt=Math.min(vt,Math.sqrt(Math.max(0,d-0.4)*2*4.5));}}
 const ah=c.ahead;if(ah&&ah.state===0){let gap=(ah.along-a)*dir;if(gap<0)gap+=LANE_LEN;if(gap<35)vt=Math.min(vt,Math.max(0,(gap-7.5)*0.8),ah.speed+Math.max(0,gap-12)*0.5);}
 return vt;}

/* ---------- open-terrain arena map ---------- */
const CITY_B=scene.children.slice(_SC1);const CITY_OBJS=[...CITY_A,...CITY_B].filter(o=>!o.isLight&&!CLOUDS.includes(o)&&o!==sun.target);
let MAP='city';const ARENA_G=new THREE.Group();ARENA_G.visible=false;scene.add(ARENA_G);
{const tT=cv(512,512,(g,w,h)=>{g.fillStyle='#5d7638';g.fillRect(0,0,w,h);for(let i=0;i<5200;i++){const v=Math.random();g.fillStyle=v<0.5?'rgba(74,104,46,'+rand(0.2,0.5).toFixed(2)+')':v<0.82?'rgba(122,142,70,'+rand(0.2,0.5).toFixed(2)+')':'rgba(122,102,70,'+rand(0.25,0.55).toFixed(2)+')';g.fillRect(rand(0,w),rand(0,h),rand(2,7),rand(2,7));}
  for(let i=0;i<18;i++){const x=rand(0,w),y=rand(0,h),r=rand(20,60),gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(128,104,72,.55)');gr.addColorStop(1,'rgba(128,104,72,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}});
 tT.wrapS=tT.wrapT=THREE.RepeatWrapping;tT.repeat.set(240,240);const tm=new THREE.MeshStandardMaterial({map:tT,roughness:0.96});GRASS_MATS.push(tm);
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(8000,8000),tm);plane.rotation.x=-Math.PI/2;plane.position.y=0.01;plane.receiveShadow=true;ARENA_G.add(plane);
 const NR=420,rk=new THREE.InstancedMesh(lumpy(1,0.35),M(0x8a8478,0.9,{flatShading:true}),NR);for(let i=0;i<NR;i++){const a=rand(0,6.283),r=rand(40,1240),s=Math.pow(rand(0.3,1),2)*6+0.4;dm.position.set(Math.cos(a)*r,s*0.15,Math.sin(a)*r);dm.rotation.set(rand(0,3),rand(0,3),rand(0,3));dm.scale.set(s,s*rand(0.5,0.9),s*rand(0.7,1.3));dm.updateMatrix();rk.setMatrixAt(i,dm.matrix);}
 dm.rotation.set(0,0,0);rk.castShadow=rk.receiveShadow=true;ARENA_G.add(rk);
 const NT=560,tr=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25,0.38,4,6).translate(0,2,0),M(0x5a4030,0.9),NT),fo=new THREE.InstancedMesh(new THREE.ConeGeometry(2.4,6.5,8).translate(0,6.6,0),M(0x2f5a2a,0.85),NT),fo2=new THREE.InstancedMesh(new THREE.ConeGeometry(1.8,4.5,8).translate(0,9.2,0),M(0x356432,0.85),NT);
 for(let i=0;i<NT;i++){const cx=rand(-1150,1150),cz=rand(-1150,1150);const a=rand(0,6.283),r=rand(0,40);let x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(Math.hypot(x,z)<70){x+=90;}const s=rand(0.8,1.7);dm.position.set(x,0,z);dm.rotation.set(0,rand(0,6),0);dm.scale.setScalar(s);dm.updateMatrix();tr.setMatrixAt(i,dm.matrix);fo.setMatrixAt(i,dm.matrix);fo2.setMatrixAt(i,dm.matrix);}
 dm.rotation.set(0,0,0);dm.scale.set(1,1,1);for(const m of[tr,fo,fo2]){m.castShadow=true;m.receiveShadow=true;ARENA_G.add(m);}
 const hills=new THREE.Group(),hm=M(0x3e5a34,1);for(let i=0;i<44;i++){const a=i/44*6.283+rand(-0.05,0.05),r=rand(1240,1430),h=rand(90,280),w=rand(170,340);const m=new THREE.Mesh(new THREE.SphereGeometry(1,18,8,0,Math.PI*2,0,Math.PI/2),hm);m.position.set(Math.cos(a)*r,-12,Math.sin(a)*r);m.scale.set(w,h,w*rand(0.7,1.2));hills.add(m);}ARENA_G.add(hills);ARENA_G.userData.hills=hills;}
function setMap(m,silent){if(m!=='city'&&m!=='arena')m='city';MAP=m;ARENA=m==='arena';for(const o of CITY_OBJS){if(ARENA){if(o.userData._v==null)o.userData._v=o.visible;o.visible=false;}else if(o.userData._v!=null){o.visible=o.userData._v;o.userData._v=null;}}
 ARENA_G.visible=ARENA;if(HELD&&ARENA){HELD.state=0;HELD=null;}renderMaps();saveDirty=true;if(!silent)toast(ARENA?'Boş arazi':'Şehir',ARENA?'Ne bina var ne insan: sadece sen ve rakiplerin':'Kalabalık şehre döndün');}
function updateArena(){if(ARENA)ARENA_G.userData.hills.position.set(pl.pos.x,0,pl.pos.z);}

/* ---------- weather: clear, rain, thunderstorm, snow ---------- */
const WX={mode:0,k:0,kr:0,ks:0,flash:0,boltT:5,base:null,rainG:null};const WX_NAMES=['Açık','Yağmurlu','Fırtına','Karlı'];
function captureWxBase(){WX.base={top:sky.material.uniforms.top.value.clone(),hor:sky.material.uniforms.hor.value.clone(),gnd:sky.material.uniforms.gnd.value.clone(),sun:sun.intensity,hemi:HEMI.intensity};}
const rainFX=(()=>{const N=IS_MOBILE?3500:8000,base=new Float32Array(N*2*3),tip=new Float32Array(N*2);for(let i=0;i<N;i++){const x=rand(-45,45),y=rand(-30,30),z=rand(-45,45);base.set([x,y,z,x,y,z],i*6);tip[i*2+1]=1;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(base.slice(),3));g.setAttribute('base',new THREE.BufferAttribute(base,3));g.setAttribute('tip',new THREE.BufferAttribute(tip,1));
 const U={uT:{value:0},uCam:{value:new V3()},uOp:{value:0},uWind:{value:new THREE.Vector2(2,1)}};
 const m=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,vertexShader:'attribute vec3 base;attribute float tip;uniform float uT;uniform vec3 uCam;uniform vec2 uWind;void main(){vec3 p;p.x=uCam.x+mod(base.x-uCam.x+45.0,90.0)-45.0;p.z=uCam.z+mod(base.z-uCam.z+45.0,90.0)-45.0;p.y=uCam.y+mod(base.y-uT*24.0-uCam.y+30.0,60.0)-30.0;p.xz+=uWind*mod(uT*0.0+base.y,1.0)*0.0;if(tip>0.5)p+=normalize(vec3(uWind.x,-24.0,uWind.y))*1.3;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);}',
  fragmentShader:'uniform float uOp;void main(){gl_FragColor=vec4(0.78,0.83,0.9,0.42*uOp);}'});
 const L=new THREE.LineSegments(g,m);L.frustumCulled=false;L.renderOrder=6;L.visible=false;scene.add(L);return{L,U};})();
const snowFX=(()=>{const N=IS_MOBILE?3000:7000,base=new Float32Array(N*3);for(let i=0;i<N;i++)base.set([rand(-50,50),rand(-30,30),rand(-50,50)],i*3);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(base.slice(),3));g.setAttribute('base',new THREE.BufferAttribute(base,3));
 const U={uT:{value:0},uCam:{value:new V3()},uOp:{value:0}};
 const m=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,vertexShader:'attribute vec3 base;uniform float uT;uniform vec3 uCam;void main(){vec3 p;p.y=uCam.y+mod(base.y-uT*1.6-uCam.y+30.0,60.0)-30.0;p.x=uCam.x+mod(base.x+sin(uT*0.7+base.y)*0.8-uCam.x+50.0,100.0)-50.0;p.z=uCam.z+mod(base.z+cos(uT*0.6+base.x)*0.8-uCam.z+50.0,100.0)-50.0;vec4 mv=viewMatrix*vec4(p,1.0);gl_PointSize=clamp(90.0/-mv.z,1.0,9.0);gl_Position=projectionMatrix*mv;}',
  fragmentShader:'uniform float uOp;void main(){vec2 q=gl_PointCoord-0.5;float a=smoothstep(0.5,0.15,length(q));gl_FragColor=vec4(1.0,1.0,1.0,a*0.9*uOp);}'});
 const P=new THREE.Points(g,m);P.frustumCulled=false;P.renderOrder=6;P.visible=false;scene.add(P);return{P,U};})();
const SNOW_C=new THREE.Color(0.86,0.88,0.92);
function setWeather(m){WX.mode=((m%4)+4)%4;syncWxUI();saveDirty=true;toast('Hava: '+WX_NAMES[WX.mode],'');}
function syncWxUI(){document.querySelectorAll('.wx').forEach(b=>b.classList.toggle('on',+b.dataset.w===WX.mode));}
function updateWeather(dt){const tr=(WX.mode===1||WX.mode===2)?1:0,ts=WX.mode===3?1:0,td=[0,0.6,1,0.5][WX.mode];
 WX.kr+=(tr-WX.kr)*Math.min(1,dt*0.5);WX.ks+=(ts-WX.ks)*Math.min(1,dt*0.25);WX.k+=(td-WX.k)*Math.min(1,dt*0.5);const k=WX.k*(1-spaceK);
 if(WX.base){const l=WX.base.hor.r*0.3+WX.base.hor.g*0.55+WX.base.hor.b*0.15,gr=new THREE.Color(l*0.95,l,l*1.06);const fl=WX.flash;
  for(const m of[sky.material,envSky.material]){m.uniforms.top.value.copy(WX.base.top).lerp(gr,k*0.85).lerp(new THREE.Color(0.9,0.92,1),fl*0.5);m.uniforms.hor.value.copy(WX.base.hor).lerp(gr,k*0.8).lerp(new THREE.Color(0.9,0.92,1),fl*0.5);}
  sun.intensity=WX.base.sun*(1-0.72*k)*(1-0.4*spaceK);HEMI.intensity=(WX.base.hemi!=null?WX.base.hemi:HEMI_BASE)*(1-0.25*k)*(1-0.5*spaceK)+fl*2.5;const fg=new THREE.Color(l,l*1.02,l*1.08).convertSRGBToLinear();scene.fog.color.copy(FOG_BASE).lerp(fg,k*0.7).lerp(new THREE.Color(0,0,0),spaceK*0.85);}
 {const gk=Math.max(1,Math.min(26,SIZE/160));scene.fog.far=1050*gk*(1-0.42*k);scene.fog.near=220*gk*(1-0.45*k);}WX.flash=Math.max(0,WX.flash-dt*3.5);
 for(const m of ASPH_MATS){m.roughness=lerp(0.95,0.3,WX.kr*(1-WX.ks));m.color.setScalar(lerp(1,0.7,WX.kr)).lerp(SNOW_C,WX.ks*0.85);}for(const m of GRASS_MATS)m.color.setScalar(1).lerp(SNOW_C,WX.ks*0.9);
 rainFX.L.visible=WX.kr>0.02&&spaceK<0.3;rainFX.U.uOp.value=WX.kr;rainFX.U.uT.value=time;rainFX.U.uCam.value.copy(camera.position);
 snowFX.P.visible=WX.ks>0.02&&spaceK<0.3;snowFX.U.uOp.value=WX.ks;snowFX.U.uT.value=time;snowFX.U.uCam.value.copy(camera.position);
 if(WX.kr>0.3&&camera.position.y<60)for(let i=0;i<3;i++)emit(dustPS,camera.position.x+rand(-25,25),0.12,camera.position.z+rand(-25,25),0,0.6,0,0.25,0.12,0.35,0.82,0.86,0.92,0.45,0,0);
 if(AC){if(!WX.rainG){const src=AC.createBufferSource();src.buffer=noiseBuf;src.loop=true;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=2600;f.Q.value=0.4;WX.rainG=AC.createGain();WX.rainG.gain.value=0;src.connect(f);f.connect(WX.rainG);WX.rainG.connect(ambBus);src.start();}WX.rainG.gain.setTargetAtTime(WX.kr*0.22*(state==='play'||state==='menu'?1:0.3),AC.currentTime,0.4);}
 if(WX.mode===2&&state==='play'&&spaceK<0.2){WX.boltT-=dt;if(WX.boltT<=0){WX.boltT=rand(3,9);const a=rand(0,6.283),d=rand(150,700),p=new V3(camera.position.x+Math.cos(a)*d,0,camera.position.z+Math.sin(a)*d);
  let hitB=null;for(const b of solidsNear(p.x,p.z))if(b.alive&&(!hitB||b.col.maxY>hitB.col.maxY))hitB=b;if(hitB)p.set((hitB.col.minX+hitB.col.maxX)/2,hitB.col.maxY,(hitB.col.minZ+hitB.col.maxZ)/2);
  const top=new V3(p.x+rand(-40,40),420,p.z+rand(-40,40)),bc=new THREE.Color(0.85,0.9,1);boltFX(top,p,bc,3.2,0.35);boltFX(top,p,bc,1.6,0.25);WX.flash=1;if(hitB&&Math.random()<0.4)damageBuilding(hitB,800,p.clone(),true);
  setTimeout(()=>{sfx('boom',clamp(1.3-d/700,0.3,1.1),0,900,0.7);sfx('collapse',0.35,0,500,0.6);},d/340*1000);}}}

/* ---------- progression ---------- */
const SAVE_KEY='gok-muhafizi-v1';
const up={hp:0,en:0,fly:0,run:0,dmg:0};
const prog={xp:0,level:1,points:0,destroyed:0,events:0,money:10000};let owned=[],laserColor='kirmizi',SAVED_POST=null,SAVED_VOL=null,SAVED_HERO=null,SAVED_WX=0,SAVED_MAP='city',SAVED_AGG=4;
let sens=1;
try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(s&&s.prog&&s.up){for(const k in prog)if(typeof s.prog[k]==='number')prog[k]=s.prog[k];for(const k in up)if(typeof s.up[k]==='number')up[k]=clamp(s.up[k],0,5);if(typeof s.sens==='number')sens=clamp(s.sens,0.6,2.4);if(typeof s.post==='boolean')SAVED_POST=s.post;if(s.hero)SAVED_HERO=s.hero;if(typeof s.wx==='number')SAVED_WX=s.wx;if(s.map)SAVED_MAP=s.map;if(typeof s.agg2==='number')SAVED_AGG=s.agg2;if(typeof s.qual==='number')SAVED_QUAL=s.qual;if(s.vol&&typeof s.vol==='object')SAVED_VOL=s.vol;if(Array.isArray(s.owned))owned=s.owned.filter(x=>typeof x==='string');if(typeof s.laserColor==='string')laserColor=s.laserColor;if(s.tod&&typeof s.tod.t==='number'){TOD.t=clamp(s.tod.t,0,1);TOD.cycle=!!s.tod.cycle;}if(s.costume)for(const k in COS_DEF)if(typeof s.costume[k]===typeof COS_DEF[k])costume[k]=s.costume[k];}}catch(e){}
let saveDirty=false,saveT=0;
function saveNow(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({prog,up,sens,costume,tod:TOD,owned,laserColor,post:POST.enabled,vol:VOL,map:MAP,agg2:AGG,qual:QUAL,hero:{id:HERO_ID,cos:Object.assign({},heroCostumes,{[HERO_ID]:Object.assign({},costume)})},wx:WX.mode}));}catch(e){}saveDirty=false;}
/* ---------- hero roster (original characters) ---------- */
const HEROES={
 guardian:{name:'Gök Muhafızı',role:'Uçan koruyucu',desc:'Ses hızını aşan uçuş, binaları ikiye kesen ısı lazeri ve şok dalgası.',pow:3,spd:3,flyS:5,scale:1,fly:true,run:55.6,sprint:111.1,jump:1,punch:1,hp:1,rmb:'eyes',q:'shock',flyN:555.6,flyF:833.3,landQ:32,look:null},
 wind:{name:'Rüzgâr',role:'Hızcı',desc:'Saatte 3.000 km koşar, her 500 km/sa artışta arkasında ses patlaması bırakır. X ile titreşerek binaların içinden geçer ve hasar almaz. Sağ tıkla zamanı tamamen durdurur, Q ile etrafında kasırga döndürür. Uçamaz.',pow:2,spd:5,flyS:0,scale:0.97,fly:false,run:83,sprint:833.3,jump:1.3,punch:0.85,hp:0.9,rmb:'slow',q:'whirl',landQ:40,
  look:{suit:'#e8eef4',acc:'#2a6fd6',cape:'#2a6fd6',mask:'#1d3f7a',hair:'#d9c9a0',energy:'#7fe6ff',capeOn:false,maskOn:true}},
 titan:{name:'Kaya',role:'Dev',desc:'Taş derili dev. Bina deviren yumruklar, 40 metrelik sıçrayışlar ve her inişte deprem. Uçamaz.',pow:5,spd:2,flyS:0,scale:1.75,fly:false,run:24,sprint:46,jump:6,punch:2.6,hp:3,rmb:null,q:'quake',landQ:14,
  look:{suit:'#6a6058',acc:'#3e3630',cape:'#3e3630',mask:'#2e2824',hair:'#2e2824',energy:'#ff7a2a',capeOn:false,maskOn:false}},
 raven:{name:'Kuzgun',role:'Zırhlı teknoloji',desc:'Jet botlarıyla uçan zırhlı kahraman. Avuçlarından plazma ışını, Q ile güdümlü mikro füzeler.',pow:4,spd:3,flyS:4,scale:1.05,fly:true,run:40,sprint:80,jump:1,punch:1.3,hp:1.6,rmb:'hands',q:'rockets',flyN:170,flyF:300,landQ:32,
  look:{suit:'#3a3f47',acc:'#7c8794',cape:'#3a3f47',mask:'#1b1f25',hair:'#1b1f25',energy:'#3fe0cc',capeOn:false,maskOn:true}}};
const AGG_LV=[{n:'Sakin',cd:1.8,hv:0.1,dmg:0.6,des:0.5,spd:0.8},{n:'Normal',cd:1.25,hv:0.22,dmg:0.85,des:0.8,spd:0.9},{n:'Saldırgan',cd:1,hv:0.35,dmg:1,des:1,spd:1},{n:'Vahşi',cd:0.6,hv:0.55,dmg:1.3,des:1.8,spd:1.2},{n:'Kıyamet',cd:0.38,hv:0.7,dmg:1.6,des:2.8,spd:1.35},{n:'Mutlak Yıkım',cd:0.25,hv:0.82,dmg:2,des:4,spd:1.5}];let AGG=4,VIL_HURT=1;const AG=()=>AGG_LV[AGG];
let HELD=null,PHOTO=false,photoZoom=1,PHASE_ON=false,PHASE_MAN=false,tsOn=false,WT=0,HERO_ID='guardian',HERO=HEROES.guardian,TS=1,SHOCK_R=18,SHOCK_MUL=1;
/* new original heroes: size shifter, ice master, teleporting ninja */
Object.assign(HEROES,{
 ice:{name:'Ayaz',role:'Buz ustası',desc:'Avuçlarından dondurucu ışın: düşmanları dondurur, değdiği yeri buzla kaplar. Q ile etrafında buz sarkıtları fışkırtır. Soğuk rüzgârla süzülerek uçar.',pow:3,spd:3,flyS:3,scale:1,fly:true,flyN:120,flyF:220,run:40,sprint:90,jump:1.2,punch:1,hp:1.2,rmb:'ice',q:'iceburst',landQ:32,
  look:{suit:'#dfeaf2',acc:'#6aa8d8',cape:'#9fd0f0',mask:'#2a4a6a',hair:'#e8eef4',energy:'#a8e6ff',capeOn:true,maskOn:true}},
 void:{name:'Hiçlik',role:'Kozmik yok edici',desc:'Başının arkasında kızıl halkalar taşıyan kozmik varlık. Gözlerinden kızıl ışın, Q ile her şeyi yutan kara delik. G ile tek hamlede şehirdeki herkesi yok eder, tekrar G ile geri getirir.',pow:5,spd:3,flyS:4,scale:1.3,fly:true,flyN:200,flyF:350,run:45,sprint:95,jump:1.3,punch:2,hp:2.5,rmb:'eyes',q:'blackhole',ult:'erase',landQ:24,
  look:{suit:'#1c1c22',acc:'#6e7178',cape:'#5a0f18',mask:'#121216',hair:'#121216',energy:'#ff2a3a',capeOn:true,maskOn:true}},
 shadow:{name:'Gölge',role:'Işınlanan ninja',desc:'Q ile baktığı yöne 60 metreye kadar ışınlanır, havada ikinci kez zıplar, en hızlı kombolara sahiptir. Uçamaz.',pow:3,spd:4,flyS:0,scale:0.98,fly:false,run:60,sprint:120,jump:1.6,punch:1.3,hp:1,rmb:null,q:'blink',landQ:36,
  look:{suit:'#17181c',acc:'#4a4d55',cape:'#2a1f3d',mask:'#0b0c0f',hair:'#0b0c0f',energy:'#b07cff',capeOn:true,maskOn:true}}});
let SIZE=1,SIZE_T=1;
Object.assign(HEROES,{
 wing:{name:'Kanat',role:'Kanatlı gözcü',desc:'Sırtında kocaman tüylü kanatlar. Çok çevik uçar. Sağ tıkı basılı tutarak uzaktaki yerleri yakınlaştırıp (dürbün gibi) görürsün.',pow:2,spd:3,flyS:5,scale:1,fly:true,flyN:210,flyF:360,run:44,sprint:92,jump:1.2,punch:1,hp:1.1,rmb:'scope',q:'shock',landQ:32,
  look:{suit:'#e8ecf2',acc:'#d8b24a',cape:'#f2f4f8',mask:'#5a6472',hair:'#caa84a',energy:'#ffe9a8',capeOn:false,maskOn:true}},
 twin:{name:'İkiz',role:'Klon ustası',desc:'Gücü klonlanma. Q ile kendi kopyalarını yaratır (en fazla 6). 1 ile saldır, 2 ile yanında dur, 3 ile dağıt komutlarını verirsin. Klonlar düşmanlara yumruk ve enerji ışınıyla saldırır. Uçabilir.',pow:3,spd:3,flyS:4,scale:1,fly:true,flyN:190,flyF:320,run:42,sprint:88,jump:1.2,punch:1.2,hp:1.3,rmb:'eyes',q:'clone',landQ:32,
  look:{suit:'#2a3cc0',acc:'#8be0ff',cape:'#1d2a7a',mask:'#141a30',hair:'#2a2418',energy:'#8be0ff',capeOn:true,maskOn:true}},
 blade:{name:'Kesici',role:'Lazer ustası',desc:'Tek gücü devasa kesici lazer. Sağ tık ile tek atışta önündeki 20-30 binayı anında ikiye keser. Gücü 20 kademeye kadar büyütürsün: rakam tuşları hızlı seçim, [ ve ] ile birer birer ayar. Uçabilir.',pow:5,spd:3,flyS:4,scale:1.04,fly:true,flyN:190,flyF:320,run:42,sprint:88,jump:1.1,punch:1,hp:1.4,rmb:'megabeam',q:null,landQ:32,
  look:{suit:'#20242c',acc:'#ff3a2a',cape:'#2a0f12',mask:'#14161b',hair:'#14161b',energy:'#ff4530',capeOn:true,maskOn:true}},
 brute:{name:'Ezgin',role:'Yeşil canavar',desc:'Devasa güçte yeşil bir canavar. Tek yumruğu 3-5 binayı birden devirir. Q ile yere vurup şehrin dörtte birini yerle bir eder. Dayanılmaz derecede dayanıklı. Uçamaz.',pow:5,spd:2,flyS:0,scale:1.45,fly:false,run:30,sprint:60,jump:3,punch:4,hp:5,rmb:null,q:'smash',landQ:16,
  look:{suit:'#3f8f3a',acc:'#2a5a28',cape:'#2a5a28',mask:'#24401f',hair:'#1a2e16',energy:'#9fff5a',capeOn:false,maskOn:false}},
 fire:{name:'Volkan',role:'Ateş ustası',desc:'Avuçlarından alev püskürtür, değdiği her şeyi tutuşturur ve eritir. Q ile etrafına ateş patlaması yayar. Uçabilir.',pow:4,spd:3,flyS:4,scale:1.02,fly:true,flyN:180,flyF:300,run:45,sprint:90,jump:1.2,punch:1.2,hp:1.4,rmb:'fire',q:'firenova',landQ:32,
  look:{suit:'#2a1a14',acc:'#7a2a10',cape:'#a83a10',mask:'#3a160c',hair:'#1a0e08',energy:'#ff7a1a',capeOn:false,maskOn:true}},
 psychic:{name:'Zihin',role:'Telekinezi ustası',desc:'Sağ tıkla nişan aldığı yerdeki arabaları, insanları ve düşmanları zihniyle havaya kaldırıp fırlatır. Q ile önündeki her şeyi savuran bir zihin dalgası gönderir. Havada süzülür.',pow:4,spd:2,flyS:3,scale:1,fly:true,flyN:140,flyF:240,run:35,sprint:70,jump:1.1,punch:0.9,hp:1.1,rmb:'tk',q:'push',landQ:32,
  look:{suit:'#2b2440',acc:'#8f7ad6',cape:'#3a2f63',mask:'#1c1830',hair:'#d8d8e8',energy:'#c58bff',capeOn:true,maskOn:false}},
 storm:{name:'Yıldırım',role:'Elektrik ustası',desc:'Elinden hedefler arasında sekerek ilerleyen zincir şimşek çıkarır. Q ile gökten nişan aldığı yere yıldırım düşürür. Fırtına gibi hızlı uçar.',pow:4,spd:4,flyS:5,scale:1,fly:true,flyN:240,flyF:420,run:50,sprint:110,jump:1.2,punch:1.1,hp:1.1,rmb:'chain',q:'thunder',landQ:32,
  look:{suit:'#1e2a3a',acc:'#cfd8e3',cape:'#1e2a3a',mask:'#0f1620',hair:'#0f1620',energy:'#7fd4ff',capeOn:false,maskOn:true}}});

function stats(){return{maxHp:HERO_ID==='shrink'?200000:(100+30*up.hp)*HERO.hp,maxEn:100+25*up.en,enRegen:14+4*up.en,run:HERO.run,sprint:HERO.sprint,jump:(7+1.4*up.run)*HERO.jump,fly:26+5*up.fly,boost:75+18*up.fly,dmg:1+0.25*up.dmg};}
let ST=stats();
function xpNeed(l){return Math.round(100*Math.pow(l,1.35));}

/* ---------- player ---------- */
const G=-30,STEP=0.5,SPAWN=new V3(0,0,12);
const pl={pos:SPAWN.clone(),vel:new V3(),grounded:true,flying:false,boosting:false,facing:Math.PI,lastG:0,jumpT:-9,hp:ST.maxHp,en:ST.maxEn,dead:false,hurtT:-9,deathT:0,tilt:0,dashT:0,punchT:-9,punchDone:true,punchDir:new V3(),shootT:-9,shockT:-9,cd:{shoot:0,punch:0,shock:0},laser:false,supersonic:false,flyMax:26,mach:0,runMax:30};
const keys={},pressed={};let mouseL=false,mouseR=false,lookX=0,lookY=0;
let FP=false,camImp=0,camImpV=0,yaw=Math.PI,pitch=0.2,camDistBase=6,camDist=6,fov=65;
const camFwd=new V3(0,0,-1),camPivot=new V3(0,1.6,12);
let time=0,state='menu';

const craters=[];function craterH(C,r){const q=r/C.R;return q<=1?0.2+C.h*Math.pow(q,2.4):q<1.45?C.h*Math.pow(1-(q-1)/0.45,1.6):0;}
function groundAt(x,y,z,r){r=r==null?0.3:r;let g=inRiver(x,z)?WATER_Y:0;for(let i=0;i<craters.length;i++){const C=craters[i],dx=x-C.x,dz=z-C.z,d2=dx*dx+dz*dz;if(d2<C.R2o)g=Math.max(g,craterH(C,Math.sqrt(d2)));}for(const b of solidsNear(x,z)){if(!b.alive)continue;const c=b.col;if(x>c.minX-r&&x<c.maxX+r&&z>c.minZ-r&&z<c.maxZ+r&&y>=c.maxY-STEP)g=Math.max(g,c.maxY);}return g;}
function pushBoxXZ(p,v,r,c){const cx=clamp(p.x,c.minX,c.maxX),cz=clamp(p.z,c.minZ,c.maxZ);let dx=p.x-cx,dz=p.z-cz;const d=Math.hypot(dx,dz);if(d>=r)return false;let nx,nz;
 if(d<1e-4){const o=[c.maxX-p.x,p.x-c.minX,c.maxZ-p.z,p.z-c.minZ],i=o.indexOf(Math.min(...o));nx=i===0?1:i===1?-1:0;nz=i===2?1:i===3?-1:0;if(i===0)p.x=c.maxX+r;else if(i===1)p.x=c.minX-r;else if(i===2)p.z=c.maxZ+r;else p.z=c.minZ-r;}
 else{nx=dx/d;nz=dz/d;p.x+=nx*(r-d);p.z+=nz*(r-d);}
 if(v){const vn=v.x*nx+v.z*nz;if(vn<0){v.x-=nx*vn;v.z-=nz*vn;}}return true;}
function collideXZ(p,v,h,r,ramSpeed){const L=solidsNear(p.x,p.z).slice();for(const b of L){if(!b.alive)continue;const c=b.col;if(p.y>=c.maxY-STEP||p.y+h<=c.minY)continue;if(p.x<c.minX-r||p.x>c.maxX+r||p.z<c.minZ-r||p.z>c.maxZ+r)continue;
 const cx=clamp(p.x,c.minX,c.maxX),cz=clamp(p.z,c.minZ,c.maxZ);if(Math.hypot(p.x-cx,p.z-cz)>=r)continue;if(ramSpeed>0&&ramBuilding(b,ramSpeed))continue;pushBoxXZ(p,v,r,c);}}
function collide3D(p,v,ramSpeed){let res=null;const L=solidsNear(p.x,p.z).slice();for(const b of L){if(!b.alive)continue;const c=b.col;const x0=p.x-0.45,x1=p.x+0.45,y0=p.y,y1=p.y+1.9,z0=p.z-0.45,z1=p.z+0.45;
 if(x1<=c.minX||x0>=c.maxX||y1<=c.minY||y0>=c.maxY||z1<=c.minZ||z0>=c.maxZ)continue;if(ramSpeed>0&&pl.flying){punchThrough(b,v);continue;}if(ramSpeed>0&&ramBuilding(b,ramSpeed))continue;
 const px=Math.min(c.maxX-x0,x1-c.minX),py=Math.min(c.maxY-y0,y1-c.minY),pz=Math.min(c.maxZ-z0,z1-c.minZ);
 if(py<=px&&py<=pz){if(c.maxY-y0<y1-c.minY){p.y+=c.maxY-y0;if(v.y<0)v.y=0;res='top';}else{p.y-=y1-c.minY;if(v.y>0)v.y=0;}}
 else if(px<=pz){if(c.maxX-x0<x1-c.minX){p.x+=c.maxX-x0;if(v.x<0)v.x=0;}else{p.x-=x1-c.minX;if(v.x>0)v.x=0;}}
 else{if(c.maxZ-z0<z1-c.minZ){p.z+=c.maxZ-z0;if(v.z<0)v.z=0;}else{p.z-=z1-c.minZ;if(v.z>0)v.z=0;}}}return res;}
function ramBuilding(b,speed){if(time-b.lastRam<0.3)return !b.alive;b.lastRam=time;const pt=pl.pos.clone();pt.y+=1;damageBuilding(b,speed*(pl.flying?7:4)*ST.dmg,pt,true);addShake(0.45);hitStop=Math.max(hitStop,0.05);sfx('boom',0.7);dustBurst(pt,18,10,4,2,6,1.3);if(!b.alive)pl.vel.multiplyScalar(0.85);return !b.alive;}
const FLY_NORM=194.4,FLY_FAST=333.3,RUN_FAST=111.1,HYPER=1500;function stopFly(){pl.flying=false;pl.boosting=false;pl.flyMax=ST.fly;pl.mach=0;}
function startFly(){if(pl.dead||!HERO.fly)return;pl.flyMax=Math.max(ST.fly,pl.vel.length());const wasG=pl.grounded;pl.flying=true;pl.grounded=false;if(pl.vel.y<6)pl.vel.y=6;sfx('jump',0.8);if(wasG)dustBurst(pl.pos,10,5,1,1.5,4,0.9);}
function land(){pl.flying=false;pl.flyMax=ST.fly;pl.mach=0;pl.boosting=false;pl.grounded=true;pl.lastG=time;pl.vel.y=0;}
function doJump(){if(civOn){pl.vel.y=Math.sqrt(2*-G*0.45);pl.jumpT=time;pl.grounded=false;pl.lastG=-9;return;}const hs=Math.hypot(pl.vel.x,pl.vel.z);pl.vel.y=Math.sqrt(2*-G*ST.jump*(SIZE>5?Math.max(3.5,SIZE*0.15):1)*(1+0.6*clamp(hs/ST.sprint,0,1)));pl.jumpT=time;pl.grounded=false;pl.lastG=-9;sfx('jump');dustBurst(pl.pos,6,3,1,1.2,3,0.7);}
function superLanding(v){const r=clamp(v/4,6,16),c=pl.pos.clone();c.y+=0.3;ringFx(c,UP,r,0.6,0xffffff);fxGroundRing(pl.pos,0.8,r*1.1,0.6,'#ffffff');fxFlash(c,1,6,0.2,'#ffffff');dustBurst(pl.pos,40,r*1.2,2,2,7,1.5);
 for(const e of enemies){if(e.dead)continue;const d=e.pos.distanceTo(pl.pos);if(d<r+e.r){const k=_v1.copy(e.pos).sub(pl.pos).setY(0).normalize().multiplyScalar(22);k.y=14;damageEnemy(e,40*ST.dmg*(1-d/(r+e.r)*0.6),k.clone());}}
 for(const b of buildings){if(!b.alive)continue;const d=boxDist(pl.pos,b.col);if(d<r*0.6)damageBuilding(b,80*ST.dmg,closestOnBox(pl.pos,b.col),true);}
 cityImpact(pl.pos,r,25);addShake(0.6);hitStop=Math.max(hitStop,0.04);sfx('land');}
function sonicBoom(n){if(n>3&&n%5)return;const c=pl.pos.clone();c.y+=1;ringFx(c,pl.vel,12,0.6,0xffffff);ringFx(c,pl.vel,7,0.4,0xbfe3ff);addShake(0.4);sfx('sonic');if(n<=3||n%10===0)toast('Mach '+n,n===1?'Ses hızı aşıldı':'Hızlanmaya devam');}
function boxDist(p,c){const x=clamp(p.x,c.minX,c.maxX),y=clamp(p.y,c.minY,c.maxY),z=clamp(p.z,c.minZ,c.maxZ);return Math.hypot(p.x-x,p.y-y,p.z-z);}
function closestOnBox(p,c){return new V3(clamp(p.x,c.minX,c.maxX),clamp(p.y,c.minY,c.maxY),clamp(p.z,c.minZ,c.maxZ));}

function updatePlayer(dt){
 if(pl.dead)return;
 if(pl.flying||pl.grounded)pl.fallTop=pl.pos.y;else pl.fallTop=Math.max(pl.fallTop==null?pl.pos.y:pl.fallTop,pl.pos.y);
 const fh=new V3(Math.sin(yaw),0,Math.cos(yaw)),rh=new V3(-Math.cos(yaw),0,Math.sin(yaw));
 const ix=clamp((keys.KeyD?1:0)-(keys.KeyA?1:0)+TOUCH.mx,-1,1),iz=clamp((keys.KeyW?1:0)-(keys.KeyS?1:0)+TOUCH.my,-1,1);
 const sprint=!!(keys.ShiftLeft||keys.ShiftRight||TOUCH.sprint);
 for(const k in pl.cd)pl.cd[k]=Math.max(0,pl.cd[k]-dt);
 if(pressed.KeyF&&!civOn){if(pl.flying)stopFly();else startFly();}
 if(pressed.Space&&!pl.flying){if(time-pl.lastG<0.15)doJump();else if(HERO_ID==='shadow'&&!pl.dj&&!civOn){pl.dj=true;pl.vel.y=Math.sqrt(2*-G*ST.jump*0.85);sfx('whoosh',0.7);dustBurst(pl.pos,6,3,1,1,3,0.6);}else if(!civOn&&time-pl.jumpT>0.15)startFly();}
 if(pl.dashT>0){pl.dashT-=dt;pl.vel.copy(pl.punchDir).multiplyScalar(40);}
 else if(pl.flying){
  const dir=new V3().addScaledVector(camFwd,iz).addScaledVector(rh,ix);dir.y+=(keys.Space?1:0)-(keys.KeyC?1:0);if(dir.lengthSq()>1)dir.normalize();
  const moving=dir.lengthSq()>0.01;pl.boosting=sprint&&moving;
  pl.flyMax=(sprint?(HERO.flyF||FLY_FAST):(HERO.flyN||FLY_NORM))*(1+Math.max(0,pl.pos.y-SPACE_Y)/900);
  const tv=dir.clone().multiplyScalar(pl.flyMax);const cur=pl.vel.length(),tl=tv.length();
  const rate=(tl>cur?Math.max(65,tl*0.6)+15*up.fly:(moving?Math.max(95,cur*0.8):Math.max(60,cur*0.5)))*dt;const diff=tv.sub(pl.vel);const el=diff.length();if(el<=rate)pl.vel.add(diff);else pl.vel.addScaledVector(diff,rate/el);
 }else{
  pl.boosting=false;let dx=fh.x*iz+rh.x*ix,dz=fh.z*iz+rh.z*ix;const L=Math.hypot(dx,dz);if(L>1){dx/=L;dz/=L;}

  const ts=civOn?(sprint?4.2:1.7):(sprint?ST.sprint:ST.run)*(SIZE<0.5?0.35:SIZE>5?clamp(SIZE*0.045,1.7,3):SIZE>1.5?1.25:1),tx=dx*ts,tz=dz*ts;const cur2=pl.vel.x*pl.vel.x+pl.vel.z*pl.vel.z,tg2=tx*tx+tz*tz;
  let rate=tg2>cur2?(sprint?Math.max(75+10*up.run,Math.sqrt(tg2)*0.42):55):Math.max(70,Math.sqrt(cur2)*0.9);if(cur2>36&&tg2>0.01&&(pl.vel.x*tx+pl.vel.z*tz)<-0.5*Math.sqrt(cur2*tg2))rate=85;if(!pl.grounded)rate*=0.35;
  const ex=tx-pl.vel.x,ez=tz-pl.vel.z,el=Math.hypot(ex,ez),st=rate*dt;if(el<=st){pl.vel.x=tx;pl.vel.z=tz;}else{pl.vel.x+=ex/el*st;pl.vel.z+=ez/el*st;}
  if(L>0.01)pl.facing=turnAngle(pl.facing,Math.atan2(dx,dz),damp(lerp(16,6,clamp(Math.sqrt(cur2)/28,0,1)),dt));
  if(pl.grounded&&pl.vel.y<0)pl.vel.y=-2;else{let gm=pl.vel.y<0?1.55:1;if(pl.vel.y>0&&!keys.Space&&time-pl.jumpT>0.06)gm=2.3;if(Math.abs(pl.vel.y)<1.6)gm=0.55;pl.vel.y+=G*gm*dt;pl.vel.y=Math.max(pl.vel.y,civOn?-90:-260);}
 }
 const sp=pl.vel.length(),hs=Math.hypot(pl.vel.x,pl.vel.z);
 if(pl.flying||pl.dashT>0&&!pl.grounded){
  const steps=Math.max(1,Math.ceil(sp*dt/0.5));let landed=false;
  if(sp>HYPER){pl.pos.addScaledVector(pl.vel,dt);for(const b of solidsNear(pl.pos.x,pl.pos.z)){const c=b.col;if(pl.pos.x>c.minX&&pl.pos.x<c.maxX&&pl.pos.z>c.minZ&&pl.pos.z<c.maxZ&&pl.pos.y<c.maxY)pl.pos.y=c.maxY+0.5;}}
  else for(let i=0;i<steps&&!landed;i++){pl.pos.addScaledVector(pl.vel,dt/steps);const r=collide3D(pl.pos,pl.vel,sp>35&&pl.dashT<=0?sp:0);if(r==='top'&&pl.vel.y<=0&&(keys.KeyC||sp<6)){land();landed=true;}}
  const gy=groundAt(pl.pos.x,pl.pos.y,pl.pos.z);
  if(pl.pos.y<gy){pl.pos.y=gy;if(pl.vel.y<-4||keys.KeyC){const imp=-pl.vel.y;land();if(imp>85&&!civOn)makeCrater(pl.pos.clone(),imp*imp/92);else if(imp>32)superLanding(imp);}else pl.vel.y=Math.max(0,pl.vel.y);}
  pl.pos.y=Math.min(pl.pos.y,60000);
  if(pl.flying){if(hs>2)pl.facing=turnAngle(pl.facing,Math.atan2(pl.vel.x,pl.vel.z),damp(8,dt));else pl.facing=turnAngle(pl.facing,yaw,damp(4,dt));}
  let tt=0.12;if(sp>5){const a=Math.acos(clamp(pl.vel.y/sp,-1,1));tt=lerp(0.15,Math.min(a,2.3),clamp((sp-5)/20,0,1));}
  pl.tilt=lerp(pl.tilt,pl.flying?tt:0,damp(6,dt));
  if(pl.flying){const ml=Math.floor(sp/343);if(ml>pl.mach){pl.mach=ml;sonicBoom(ml);}else if(ml<pl.mach&&sp<pl.mach*343-60)pl.mach=ml;}
 }else{
  pl.tilt=lerp(pl.tilt,0,damp(10,dt));pl.supersonic=false;{const ml=Math.floor(hs/343);if(ml>pl.mach&&pl.grounded){pl.mach=ml;sonicBoom(ml);dustBurst(pl.pos,30,18,3,3,9,1.6);}else if(ml<pl.mach&&hs<pl.mach*343-60)pl.mach=ml;}
  const steps=Math.max(1,Math.ceil(hs*dt/0.4)),ram=SIZE>5?999:(hs>70&&pl.dashT<=0?hs:0);
  for(let i=0;i<steps;i++){pl.pos.x+=pl.vel.x*dt/steps;pl.pos.z+=pl.vel.z*dt/steps;if(!PHASE_ON)collideXZ(pl.pos,pl.vel,1.9*Math.max(1,SIZE),SIZE>5?SIZE*0.3:0.5,ram);}
  const prevVy=pl.vel.y;pl.pos.y+=pl.vel.y*dt;const gy=groundAt(pl.pos.x,pl.pos.y,pl.pos.z);const was=pl.grounded;
  if(pl.pos.y<=gy||(was&&pl.vel.y<=0&&pl.pos.y-gy<0.5)){if(!was){camImpV-=clamp(-prevVy,0,40)*0.03;HA.landT=0;HA.landK=clamp((-prevVy-4)/26,0,1);}if(!was&&!civOn&&(pl.fallTop||0)-gy>80){makeCrater(pl.pos.clone(),pl.fallTop-gy);pl.fallTop=gy;}else if(!was&&prevVy<-(SIZE>1.5?12:HERO.landQ))superLanding(-prevVy*(HERO_ID==='titan'?1.6:1));else if(!was&&prevVy<-14){sfx('land',0.4);dustBurst(pl.pos,8,4,1,1.2,3,0.8);}else if(!was&&prevVy<-6)sfx('land',0.18);pl.pos.y=gy;pl.grounded=pl.vel.y<=0;if(pl.grounded){pl.lastG=time;pl.dj=false;pl.vel.y=Math.min(pl.vel.y,0);}}else pl.grounded=false;
 }
 const WB=1250,wrap=v=>((v+WB)%(2*WB)+2*WB)%(2*WB)-WB;pl.pos.x=wrap(pl.pos.x);pl.pos.z=wrap(pl.pos.z);
 if(!pl.laser)pl.en=Math.min(ST.maxEn,pl.en+ST.enRegen*dt);
 if(time-pl.hurtT>5)pl.hp=Math.min(ST.maxHp,pl.hp+6*dt);
 if(pl.punchT>=0&&!pl.punchDone&&time-pl.punchT>0.12)resolvePunch();
}

/* ---------- camera & aim ---------- */
function rayBox(o,d,c,tmax){let t0=0,t1=tmax;
 if(Math.abs(d.x)<1e-8){if(o.x<c.minX||o.x>c.maxX)return -1;}else{let a=(c.minX-o.x)/d.x,b=(c.maxX-o.x)/d.x;if(a>b){const q=a;a=b;b=q;}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return -1;}
 if(Math.abs(d.y)<1e-8){if(o.y<c.minY||o.y>c.maxY)return -1;}else{let a=(c.minY-o.y)/d.y,b=(c.maxY-o.y)/d.y;if(a>b){const q=a;a=b;b=q;}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return -1;}
 if(Math.abs(d.z)<1e-8){if(o.z<c.minZ||o.z>c.maxZ)return -1;}else{let a=(c.minZ-o.z)/d.z,b=(c.maxZ-o.z)/d.z;if(a>b){const q=a;a=b;b=q;}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return -1;}
 return t0;}
function raycastWorld(o,d,tmax,withEnemies){let best=tmax,hb=null,he=null;
 if(!ARENA)for(const b of buildings){if(!b.alive)continue;const t=rayBox(o,d,b.col,best);if(t>=0&&t<best){best=t;hb=b;}}
 if(d.y<-1e-6){const tg=-o.y/d.y;if(tg>0&&tg<best){best=tg;hb=null;}}
 if(withEnemies)for(const e of enemies){if(e.dead)continue;_v1.set(e.pos.x,e.pos.y+e.cy,e.pos.z).sub(o);const tc=_v1.dot(d);if(tc<0||tc>best)continue;const d2=_v1.lengthSq()-tc*tc;if(d2<e.r*e.r){const t=tc-Math.sqrt(e.r*e.r-d2);if(t>0&&t<best){best=t;he=e;hb=null;}}}
 let hc=null,hpd=null;if(withEnemies){const ro=raycastOuter(o,d,best);if(ro.b){best=ro.t;hb=ro.b;he=null;}
  for(const c of cars){if(ARENA||c.state!==0)continue;_v1.set(c.pos.x,0.9,c.pos.z).sub(o);const tc=_v1.dot(d);if(tc<0||tc>best)continue;const d2=_v1.lengthSq()-tc*tc;if(d2<2.6){const t=tc-Math.sqrt(2.6-d2);if(t>0&&t<best){best=t;hc=c;hb=null;he=null;}}}
  for(const pd of peds){if(ARENA||pd.down>0)continue;_v1.set(pd.x,1.0,pd.z).sub(o);const tc=_v1.dot(d);if(tc<0||tc>best)continue;const d2=_v1.lengthSq()-tc*tc;if(d2<0.22){const t=tc-Math.sqrt(0.22-d2);if(t>0&&t<best){best=t;hpd=pd;hc=null;hb=null;he=null;}}}}
 return{t:best,b:hb,e:he,car:hc,ped:hpd};}
const _cells=new Set();
function raycastOuter(o,d,tmax){let best=tmax,hb=null;_cells.clear();for(let t=0;t<=Math.min(tmax,best);t+=10){const y=o.y+d.y*t;if(y<-2)break;const k=gk(gc(o.x+d.x*t),gc(o.z+d.z*t));if(_cells.has(k))continue;_cells.add(k);const l=GRID.get(k);if(!l)continue;for(const b of l){if(!b.alive||!b.outer)continue;const tt=rayBox(o,d,b.col,best);if(tt>=0&&tt<best){best=tt;hb=b;}}}return{t:best,b:hb};}
const aim={point:new V3(),b:null,e:null};
function updateCamera(dt,attract){
 const sp=pl.vel.length();
 const sf=clamp(Math.log2(Math.max(1,sp/25))/3.8,0,1);const tgtDist=(attract==='cos'?3.3:attract?6.5:pl.flying?8+7*sf:civOn?4.3:(sp>ST.run+3?7.5+3.5*clamp(Math.log2(Math.max(1,sp/10))/1.5,0,1):5.8))*Math.pow(HERO.scale*SIZE,SIZE>5?0.8:0.9);camDistBase=lerp(camDistBase,tgtDist*(PHOTO?photoZoom:1),damp(3,dt));
 const target=new V3(pl.pos.x,pl.pos.y+(attract==='cos'?1.15:pl.flying?1.2:1.6)*HERO.scale*SIZE,pl.pos.z);const hk=damp(Math.max(pl.boosting?10:18,sp*0.25),dt),vk=damp(attract||pl.flying?Math.max(14,sp*0.25):(pl.grounded?16:7),dt);camPivot.x=lerp(camPivot.x,target.x,hk);camPivot.z=lerp(camPivot.z,target.z,hk);camPivot.y=lerp(camPivot.y,target.y,vk);if(camPivot.distanceTo(target)>30)camPivot.copy(target);
 camImpV+=(-120*camImp-14*camImpV)*dt;camImp+=camImpV*dt;
 const cp=Math.cos(pitch),back=new V3(-Math.sin(yaw)*cp,Math.sin(pitch),-Math.cos(yaw)*cp),right=new V3(-Math.cos(yaw),0,Math.sin(yaw));
 const piv=camPivot.clone().addScaledVector(right,attract==='cos'?0.75:attract?0:0.75);piv.y+=camImp;
 let d=camDistBase;const r=raycastWorld(piv,back,d+0.5,false);if(r.t<d+0.5)d=Math.max(0.6,r.t-0.5);
 camDist=d<camDist?d:mt(camDist,d,10*dt);
 camera.position.copy(piv).addScaledVector(back,camDist);if(camera.position.y<0.5)camera.position.y=0.5;
 camera.near=clamp(0.1+Math.max(0,camera.position.y-25)*0.006+camDist*0.02,0.1,Math.max(0.1,camDist*0.45));
 camera.lookAt(piv);camFwd.copy(back).negate();
 if(FP&&!attract&&!pl.dead){const hs2=Math.hypot(pl.vel.x,pl.vel.z),bob=pl.grounded?Math.sin(HA.ph*2)*0.035*clamp(hs2/10,0,1):0;const eye=new V3(pl.pos.x,pl.pos.y+(pl.flying?1.25:(civOn?1.62:1.72))*HERO.scale*SIZE+bob+camImp*0.5,pl.pos.z);camera.position.copy(eye);camera.lookAt(eye.clone().sub(back));camera.near=0.08;camDist=0.3;hero.visible=false;}else hero.visible=true;
 trauma=Math.max(0,trauma-dt*1.4);const s=trauma*trauma;if(s>0.0001){camera.rotation.x+=(Math.random()-0.5)*0.06*s;camera.rotation.y+=(Math.random()-0.5)*0.06*s;camera.position.x+=(Math.random()-0.5)*0.8*s;camera.position.y+=(Math.random()-0.5)*0.8*s;}
 const f=pl.flying?sf:clamp(Math.log2(Math.max(1,sp/20))/2.5,0,1)*0.85;
 const scoping=HERO.rmb==='scope'&&mouseR&&!pl.dead&&!civOn&&state==='play';scopeK=lerp(scopeK,scoping?1:0,damp(8,dt));if(scopeK>0.05){scene.fog.far=Math.max(scene.fog.far,1050+scopeK*1600);scene.fog.near=Math.max(scene.fog.near,300);}const baseFov=65+(pl.flying?30:24)*f;fov=lerp(fov,lerp(baseFov,12,scopeK),damp(scoping?10:4,dt));camera.fov=fov;camera.updateProjectionMatrix();
 const sc=(app.clientHeight*renderer.getPixelRatio())/(2*Math.tan(fov*D2R/2));dustPS.mat.uniforms.scale.value=sc;glowPS.mat.uniforms.scale.value=sc;
 {const ld=SUN_OFF.clone().normalize(),rt=new V3().crossVectors(ld,UP).normalize(),uv=new V3().crossVectors(rt,ld).normalize(),tx=(sun.shadow.camera.right-sun.shadow.camera.left)/sun.shadow.mapSize.x,p=pl.pos;const sp=rt.multiplyScalar(Math.round(p.dot(rt)/tx)*tx).add(uv.multiplyScalar(Math.round(p.dot(uv)/tx)*tx)).add(ld.clone().multiplyScalar(p.dot(ld)));sun.target.position.copy(sp);sun.position.copy(sp).add(SUN_OFF);}}
function updateAim(){const o=camera.position.clone().addScaledVector(camFwd,camDist+0.8);const r=raycastWorld(o,camFwd,700,true);aim.point.copy(o).addScaledVector(camFwd,r.t);aim.b=r.b;aim.e=r.e;aim.car=r.car;aim.ped=r.ped;}

/* ---------- buildings: damage & collapse ---------- */
function damageBuilding(b,dmg,pt,big,cont){if(!b.alive)return;if(VILLAIN_ACTING)dmg*=AG().des;if(VILLAIN_ACTING&&pt&&!ARENA&&Math.random()<(cont?0.02:0.35))igniteAt(pt,b);if(b.outer){b.hp-=dmg;if(!cont||Math.random()<0.12){spawnDebris(pt,clamp(Math.round(dmg/15),2,big?20:8),big?15:8,0.2,big?1.3:0.7,b.wallColor);dustBurst(pt,big?12:4,big?6:3,2,1.5,big?6:3.5,1.4);}if(b.hp<=0)crumbleOuter(b,pt);return;}b.hp-=dmg;b.shake=Math.min(0.5,b.shake+dmg/400);
 if(!cont||Math.random()<0.12){spawnDebris(pt,clamp(Math.round(dmg/15),2,big?22:10),big?16:9,0.2,big?1.4:0.7,b.wallColor);dustBurst(pt,big?14:5,big?6:3,2,1.5,big?6:3.5,1.4);}
 if(b.hp<=0)collapseBuilding(b);}
function collapseBuilding(b){clearScorch(b);clearMarks(b);b.alive=false;b.collapse=0;setAO(b,false);for(const k of b.kids)if(k.alive)collapseBuilding(k);cityImpact(new V3(b.x,0,b.z),Math.max(b.w,b.d)*0.7+4,15);b.tilt.set(rand(-0.12,0.12),0,rand(-0.12,0.12));prog.destroyed++;addXP(15+Math.round(b.h/5),'Bina yıkıldı');
 const mid=new V3(b.x,b.h*0.5,b.z);sfxAt('collapse',mid,520,1);addShakeAt(mid,1.1);spawnDebris(new V3(b.x,b.h*0.8,b.z),40,18,0.6,2.8,b.wallColor,0.8);
 for(let i=0;i<24;i++){const p=perimeterPoint(b,rand(0.5,3));dustBurst(p,1,10,2,4,10,2.6);}}
function perimeterPoint(b,y){const s=randi(0,3),t=rand(-0.5,0.5);const x=s<2?b.x+(s?1:-1)*b.w/2:b.x+t*b.w,z=s<2?b.z+t*b.d:b.z+(s===2?1:-1)*b.d/2;return new V3(x,y,z);}
let lodT=0;function updateLOD(dt){if(ARENA)return;lodT-=dt;if(lodT>0)return;lodT=pl.vel.length()>300?0:0.3;for(const o of outer){if(!o.alive&&time>o.respawnAt&&Math.hypot(pl.pos.x-o.x,pl.pos.z-o.z)>200){o.alive=true;o.hp=o.maxHp;oSet(o,true);}}const cx=camera.position.x,cz=camera.position.z,cy=camera.position.y,far=scene.fog.far-15,near=cy>120?380:520;
 for(const b of buildings){if(!b.alive&&b.collapse<0)continue;const d=Math.hypot(b.x-cx,b.z-cz);b.mesh.visible=d<far;const nv=d<near;for(const ch of b.mesh.children)ch.visible=nv;}}
function updateBuildings(dt){for(const b of buildings){
 if(b.collapse>=0){b.collapse+=dt;const k=clamp(b.collapse/3.2,0,1);const j=(1-k)*0.35;b.mesh.position.set(b.x+rand(-j,j),b.y0+b.h/2-(b.h+b.y0)*Math.pow(k,1.7),b.z+rand(-j,j));b.mesh.rotation.x=b.tilt.x*k;b.mesh.rotation.z=b.tilt.z*k;
  b.dustT-=dt;if(b.dustT<=0){b.dustT=0.05;const p=perimeterPoint(b,rand(0.5,4));emit(dustPS,p.x,p.y,p.z,(p.x-b.x)*0.25,rand(1,4),(p.z-b.z)*0.25,rand(2,3.5),4,12,0.62,0.58,0.52,0.8,0.9,0.2);if(Math.random()<0.3)spawnDebris(new V3(b.x+rand(-b.w/2,b.w/2),Math.max(1,b.h*(1-Math.pow(k,1.7))),b.z+rand(-b.d/2,b.d/2)),2,8,0.4,1.6,b.wallColor);}
  if(k>=1){b.mesh.visible=false;b.collapse=-1;if(b.y0>0){b.respawnAt=time+150;continue;}if(!b.rubble){b.rubble=new THREE.Mesh(rubbleGeo(b.w,b.d),rubbleMat);b.rubble.castShadow=b.rubble.receiveShadow=true;b.rubble.position.set(b.x,0,b.z);scene.add(b.rubble);}b.rubble.visible=true;b.respawnAt=time+150;}
  continue;}
 if(!b.alive){if(time>b.respawnAt&&(!b.parentB||b.parentB.alive)&&Math.hypot(pl.pos.x-b.x,pl.pos.z-b.z)>170){b.alive=true;b.hp=b.maxHp;b.mesh.visible=true;b.mesh.position.set(b.x,b.y0+b.h/2,b.z);b.mesh.rotation.set(0,0,0);if(b.rubble)b.rubble.visible=false;setAO(b,true);}continue;}
 if(b.shake>0){b.shake=Math.max(0,b.shake-dt*1.5);const s=b.shake*0.6;b.mesh.position.set(b.x+rand(-s,s),b.y0+b.h/2,b.z+rand(-s,s));if(b.shake===0)b.mesh.position.set(b.x,b.y0+b.h/2,b.z);}
 if(b.hp<b.maxHp*0.6){const dx=pl.pos.x-b.x,dz=pl.pos.z-b.z;if(dx*dx+dz*dz<260*260){b.smokeT-=dt;if(b.smokeT<=0){b.smokeT=0.14;const x=b.x+rand(-b.w/2,b.w/2),z=b.z+rand(-b.d/2,b.d/2);emit(dustPS,x,b.y0+b.h,z,rand(-1,1),rand(3,6),rand(-1,1),rand(2.5,4),3,11,0.2,0.2,0.21,0.7,0.3,0.4);if(b.hp<b.maxHp*0.3)emit(glowPS,x,b.y0+b.h+0.5,z,rand(-1,1),rand(2,4),rand(-1,1),rand(0.4,0.8),2.5,4.5,1,0.45,0.1,1,1,1);}}}}}

/* ---------- projectiles ---------- */
const projGeo=new THREE.SphereGeometry(1,12,10);
const glowMat=c=>new THREE.MeshBasicMaterial({color:lin(c),transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false});
const energyMat=glowMat(0x8fdcff),boltMat=glowMat(0xff4436),missileMat=glowMat(0xffa040);
const projectiles=[];
function spawnProj(o){let p=null;for(const q of projectiles)if(!q.active){p=q;break;}if(!p){if(projectiles.length>=180)return null;p={mesh:new THREE.Mesh(projGeo,energyMat)};scene.add(p.mesh);projectiles.push(p);}
 p.mil=false;p.target=null;p.delay=0;
 if(!p.halo){p.halo=new THREE.Sprite(new THREE.SpriteMaterial({map:flareTex,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,fog:false}));p.mesh.add(p.halo);}
 p.halo.material.color.copy(lin(o.kind==='energy'?energyHex():o.kind==='bolt'?'#ff4436':'#ffa040')).multiplyScalar(hdr());p.halo.scale.setScalar(o.kind==='energy'?4.2:o.kind==='bolt'?5:4.5);
 p.active=true;p.kind=o.kind;p.pos=o.pos.clone();p.vel=o.vel.clone();p.size=o.size;p.life=o.life;p.dmg=o.dmg;p.owner=o.owner;p.speed=o.vel.length();p.mesh.material=o.mat;p.mesh.scale.setScalar(o.size);p.mesh.position.copy(p.pos);p.mesh.visible=true;return p;}
function deact(p){p.active=false;p.mesh.visible=false;}
function distPointSeg(q,a,dir,L){const t=clamp(_v1.copy(q).sub(a).dot(dir),0,L);return _v1.copy(a).addScaledVector(dir,t).distanceTo(q);}
function updateProjectiles(dt){const chest=new V3(pl.pos.x,pl.pos.y+1.2*HERO.scale*SIZE,pl.pos.z),ec=new V3();
 for(const p of projectiles){if(!p.active)continue;p.life-=dt;if(p.life<=0){deact(p);continue;}
  if(p.kind==='rocket'){if(p.delay>0){p.delay-=dt;}else{const tp=p.target&&!p.target.dead?new V3(p.target.pos.x,p.target.pos.y+p.target.cy,p.target.pos.z):p.tpt;const want=tp.clone().sub(p.pos).normalize().multiplyScalar(p.speed);p.vel.lerp(want,damp(4,dt)).setLength(Math.min(p.speed,p.vel.length()+120*dt));}emit(glowPS,p.pos.x,p.pos.y,p.pos.z,0,0,0,0.18,0.7,0.2,1,0.6,0.25,1,0,0);if(Math.random()<0.6)emit(dustPS,p.pos.x,p.pos.y,p.pos.z,rand(-.4,.4),rand(0,.6),rand(-.4,.4),0.9,0.6,2.2,0.7,0.7,0.72,0.5,0.6,0.2);}
  if(p.kind==='missile'){const want=chest.clone().sub(p.pos).normalize().multiplyScalar(p.speed);p.vel.lerp(want,damp(1.6,dt)).setLength(p.speed);emit(dustPS,p.pos.x,p.pos.y,p.pos.z,rand(-.5,.5),rand(0,1),rand(-.5,.5),1.2,1,3.5,0.55,0.55,0.55,0.6,0.5,0.2);}
  const prev=p.pos.clone();p.pos.addScaledVector(p.vel,dt);const seg=p.pos.clone().sub(prev);const L=seg.length()||1e-6;seg.divideScalar(L);
  if(p.kind==='energy'){const ec=new THREE.Color(energyHex()),ph=time*38+p.life*10;for(let k=0;k<2;k++){const a=ph+k*Math.PI;const ox=Math.cos(a)*0.28,oy=Math.sin(a)*0.28;emit(glowPS,p.pos.x+ox,p.pos.y+oy,p.pos.z+ox*0.5,0,0,0,0.3,0.55,0.08,ec.r,ec.g,ec.b,0.95,0,0);}emit(glowPS,p.pos.x,p.pos.y,p.pos.z,rand(-0.3,0.3),rand(-0.3,0.3),rand(-0.3,0.3),0.22,1.2,0.25,Math.min(1,ec.r+0.3),Math.min(1,ec.g+0.3),Math.min(1,ec.b+0.3),0.9,0,0);}
  let hitT=L,hitB=null,ground=false;
  for(const b of buildings){if(!b.alive)continue;const t=rayBox(prev,seg,b.col,hitT);if(t>=0&&t<hitT){hitT=t;hitB=b;}}
  if(seg.y<0&&p.pos.y<=0.05){const tg=prev.y/-seg.y;if(tg<hitT){hitT=tg;hitB=null;ground=true;}}
  let done=false;
  if(p.owner===0){for(const c of cars){if(c.state!==0)continue;ec.set(c.pos.x,0.9,c.pos.z);if(distPointSeg(ec,prev,seg,L)<1.8+p.size){destroyCar(c);sparks(ec,10,10,[0.6,0.85,1]);done=true;break;}}}
  if(!done&&p.owner===0){for(const e of enemies){if(e.dead)continue;ec.set(e.pos.x,e.pos.y+e.cy,e.pos.z);if(distPointSeg(ec,prev,seg,L)<e.r+p.size){const pt=ec.clone().addScaledVector(seg,-e.r*0.8);sparks(pt,10,10,[0.6,0.85,1]);fireBurst(pt,6,5,0.6);sfxAt('small',pt,200,0.6);damageEnemy(e,p.dmg,seg.clone().multiplyScalar(e.type==='drone'?14:6).setY(e.type==='drone'?2:4));splash(pt,4,p.dmg*0.35,e);done=true;break;}}}
  else if(p.owner!==0&&!pl.dead&&!PHASE_ON&&distPointSeg(chest,prev,seg,L)<1.1){hurt(p.dmg);sparks(chest,8,8,[1,0.4,0.3]);if(p.kind==='missile'){fireBurst(chest,20,10);sfxAt('boom',chest,200,0.5);}done=true;}
  if(!done&&(hitB||ground)){impact(p,prev.clone().addScaledVector(seg,hitT),hitB);done=true;}
  if(done)deact(p);else p.mesh.position.copy(p.pos);}}
function splash(pt,r,dmg,skip){for(const e of enemies){if(e.dead||e===skip)continue;if(e.pos.distanceTo(pt)<r+e.r)damageEnemy(e,dmg,null);}}
function impact(p,pt,b){
 if(p.kind==='energy'){const eh=energyHex(),ec=new THREE.Color(eh);fxFlash(pt,0.6,5.5,0.28,eh);fxFlash(pt,1.2,7,0.16,'#ffffff',starTex);fxDome(pt,0.3,3.6,0.32,ec);ringFx(pt,camera.position.clone().sub(pt),4.5,0.3,0xffffff);sparks(pt,22,16,[ec.r,ec.g,ec.b]);fireBurst(pt,8,6,0.7);flashAt(pt,3.5);addShakeAt(pt,0.12);sfxAt('zap',pt,240,0.9);if(b)damageBuilding(b,p.dmg*1.6,pt,false);splash(pt,4,p.dmg*0.5,null);cityImpact(pt,4,18);}
 else if(p.kind==='rocket'){if(p.mil)MIL_ACTING=true;fireBurst(pt,22,10);fxFlash(pt,0.6,5,0.25,'#ffb060');flashAt(pt,4);sfxAt('boom',pt,260,0.55);if(b)damageBuilding(b,p.dmg*1.6,pt,true);splash(pt,5,p.dmg*0.7,null);cityImpact(pt,4,16);MIL_ACTING=false;}
 else if(p.kind==='bolt'){sparks(pt,6,6,[1,0.35,0.25]);if(b)damageBuilding(b,2,pt,false,true);}
 else{fireBurst(pt,30,12);fxFlash(pt,1,7,0.3,'#ffb060');dustBurst(pt,8,4,3,2,6,1.5,[0.3,0.3,0.3]);flashAt(pt,4);sfxAt('boom',pt,260,0.6);if(b)damageBuilding(b,60,pt,true);cityImpact(pt,5,20);const d=pt.distanceTo(pl.pos);if(d<5)hurt(12*(1-d/5));}}

/* ---------- power VFX: flares, energy domes, ground rings, beam ribbons ---------- */
const LIN_MATS=[earthGroup.userData.atmo.material];
const flareTex=cv(128,128,(g,w,h)=>{const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(0.12,'rgba(255,255,255,0.95)');gr.addColorStop(0.35,'rgba(255,255,255,0.3)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
const starTex=cv(128,128,(g,w,h)=>{for(const [x0,y0,x1,y1] of[[0,64,128,64],[64,0,64,128]]){const gr=g.createLinearGradient(x0,y0,x1,y1);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(0.5,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;if(x0===0)g.fillRect(0,61,128,6);else g.fillRect(61,0,6,128);}const gr=g.createRadialGradient(64,64,0,64,64,22);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
const ringTex=cv(128,128,(g,w,h)=>{const gr=g.createRadialGradient(64,64,20,64,64,64);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(0.72,'rgba(255,255,255,1)');gr.addColorStop(0.86,'rgba(255,255,255,0.35)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
const energyHex=()=>(typeof costume!=='undefined'&&costume.energy)||'#6fd0ff';
const hdr=()=>(typeof POST!=='undefined'&&POST.enabled)?2.6:1;
const FXS=[];for(let i=0;i<56;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:flareTex,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,fog:false}));sp.visible=false;sp.renderOrder=5;scene.add(sp);FXS.push({sp,life:0,max:1,s0:1,s1:1});}let fxI=0;
function fxFlash(pos,s0,s1,life,color,tex){const f=FXS[fxI];fxI=(fxI+1)%FXS.length;f.sp.material.map=tex||flareTex;f.sp.material.color.copy(lin(color)).multiplyScalar(hdr());f.sp.material.rotation=rand(0,6.28);f.sp.position.copy(pos);f.s0=s0;f.s1=s1;f.life=f.max=life;f.sp.visible=true;f.sp.scale.setScalar(s0);}
const DOME_VS='varying vec3 vN;varying vec3 vV;void main(){vec4 wp=modelMatrix*vec4(position,1.0);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}';
const DOME_FS='uniform vec3 col;uniform float op;uniform float lin;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.2);vec3 c=mix(col,pow(col,vec3(2.2)),lin);gl_FragColor=vec4(c*f*op*2.2,1.0);}';
const DOMES=[];for(let i=0;i<10;i++){const mat=new THREE.ShaderMaterial({uniforms:{col:{value:new THREE.Color()},op:{value:1},lin:{value:0}},vertexShader:DOME_VS,fragmentShader:DOME_FS,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});LIN_MATS.push(mat);const m=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),mat);m.visible=false;m.frustumCulled=false;scene.add(m);DOMES.push({m,life:0,max:1,r0:1,r1:1});}let domeI=0;
function fxDome(pos,r0,r1,life,color){const d=DOMES[domeI];domeI=(domeI+1)%DOMES.length;d.m.material.uniforms.col.value.set(color);d.m.position.copy(pos);d.r0=r0;d.r1=r1;d.life=d.max=life;d.m.visible=true;d.m.scale.setScalar(r0);}
const DECALS=[];for(let i=0;i<8;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:ringTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6,fog:false}));m.visible=false;m.frustumCulled=false;m.renderOrder=4;scene.add(m);DECALS.push({m,life:0,max:1,r0:1,r1:1});}let decI=0;
function fxGroundRing(pos,r0,r1,life,color){const d=DECALS[decI];decI=(decI+1)%DECALS.length;d.m.material.color.copy(lin(color)).multiplyScalar(hdr());d.m.position.set(pos.x,pos.y+0.12,pos.z);d.r0=r0;d.r1=r1;d.life=d.max=life;d.m.visible=true;d.m.scale.setScalar(r0);}
function updateFX(dt){
 for(const f of FXS){if(f.life<=0){f.sp.visible=false;continue;}f.life-=dt;const k=1-Math.max(0,f.life)/f.max;f.sp.scale.setScalar(f.s0+(f.s1-f.s0)*(1-Math.pow(1-k,3)));f.sp.material.opacity=(1-k)*(1-k);}
 for(const d of DOMES){if(d.life<=0){d.m.visible=false;continue;}d.life-=dt;const k=1-Math.max(0,d.life)/d.max;d.m.scale.setScalar(d.r0+(d.r1-d.r0)*(1-Math.pow(1-k,2.5)));d.m.material.uniforms.op.value=(1-k)*hdr();}
 for(const d of DECALS){if(d.life<=0){d.m.visible=false;continue;}d.life-=dt;const k=1-Math.max(0,d.life)/d.max;d.m.scale.setScalar(d.r0+(d.r1-d.r0)*(1-Math.pow(1-k,3)));d.m.material.opacity=(1-k);}}
/* heat-vision beam ribbons: camera-facing, white-hot core, flowing heat */
const BEAM_FS='uniform vec3 col;uniform float time;uniform float len;uniform float inten;uniform float lin;varying vec2 vUv;void main(){float y=abs(vUv.y-0.5)*2.0;float core=exp(-y*y*34.0);float glow=exp(-y*y*3.2);float flow=0.68+0.32*sin(vUv.x*len*1.7-time*48.0)*sin(vUv.x*len*0.43-time*23.0);float ends=smoothstep(0.0,0.012,vUv.x)*smoothstep(1.0,0.99,vUv.x);vec3 c=mix(col,pow(col,vec3(2.2)),lin);vec3 o=(c*glow*0.95*flow+vec3(1.0,0.96,0.9)*core*1.7)*inten*ends;gl_FragColor=vec4(o,1.0);}';
const ribbons=[0,1].map(()=>{const mat=new THREE.ShaderMaterial({uniforms:{col:{value:new THREE.Color(0xff5a2a)},time:{value:0},len:{value:10},inten:{value:1},lin:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:BEAM_FS,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});LIN_MATS.push(mat);const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat);m.matrixAutoUpdate=false;m.frustumCulled=false;m.visible=false;m.renderOrder=6;scene.add(m);return m;});
const _rbD=new V3(),_rbS=new V3(),_rbN=new V3(),_rbM=new THREE.Vector3(),_rbC=new V3();
function placeRibbon(r,a,b,w){_rbD.copy(b).sub(a);const len=_rbD.length()||1e-3;_rbD.divideScalar(len);_rbM.copy(a).add(b).multiplyScalar(0.5);_rbC.copy(camera.position).sub(_rbM).normalize();_rbS.crossVectors(_rbD,_rbC);if(_rbS.lengthSq()<1e-6)_rbS.set(0,1,0);_rbS.normalize();_rbN.crossVectors(_rbS,_rbD);
 r.matrix.makeBasis(_rbD.clone().multiplyScalar(len),_rbS.clone().multiplyScalar(w),_rbN);r.matrix.setPosition(_rbM);r.matrixWorldNeedsUpdate=true;r.material.uniforms.len.value=len;}
const eyeFlares=[0,1].map(()=>{const a=new THREE.Sprite(new THREE.SpriteMaterial({map:flareTex,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,fog:false})),b=new THREE.Sprite(new THREE.SpriteMaterial({map:starTex,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,fog:false}));a.visible=b.visible=false;a.renderOrder=b.renderOrder=7;scene.add(a,b);return{a,b};});
const hitGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:flareTex,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,fog:false}));hitGlow.visible=false;hitGlow.renderOrder=6;scene.add(hitGlow);
let laserT=0;

/* ---------- powers ---------- */
const beamGeo=new THREE.CylinderGeometry(1,1,1,8,1,true);beamGeo.translate(0,0.5,0);beamGeo.rotateX(Math.PI/2);
const LASER_COLS={kirmizi:0xff5a2a,mavi:0x3aa8ff,yesil:0x3dff7a,mor:0xc04dff};
const beams=[0,1].map(()=>{const o=new THREE.Mesh(beamGeo,glowMat(0xff5a2a));const c=new THREE.Mesh(beamGeo,glowMat(0xfff2c0));o.add(c);c.scale.set(0.4,0.4,1);o.visible=false;scene.add(o);return o;});
let hitMarkT=0;
function tryShoot(){if(pl.dead||pl.cd.shoot>0||pl.en<5)return;pl.cd.shoot=0.2;pl.en-=5;pl.shootT=time;const hand=AR.fist.getWorldPosition(new V3());const dir=aim.point.clone().sub(hand).normalize();
 energyMat.color.copy(lin(energyHex())).lerp(new THREE.Color(1,1,1),0.55);spawnProj({kind:'energy',pos:hand,vel:dir.multiplyScalar(125),size:0.42,mat:energyMat,life:3,dmg:28*ST.dmg,owner:0});sfx('shoot');fxFlash(hand,0.2,1.4,0.12,energyHex());fxFlash(hand,0.3,1.9,0.1,'#ffffff',starTex);const ec=new THREE.Color(energyHex());sparks(hand,8,5,[ec.r,ec.g,ec.b]);}
function tryPunch(){if(pl.dead||pl.cd.punch>0)return;pl.combo=(time-pl.punchT<0.75&&pl.punchDone)?((pl.combo||0)+1)%3:0;pl.cd.punch=pl.combo===2?0.75:0.3;pl.punchT=time;pl.punchDone=false;const d=camFwd.clone();if(!pl.flying)d.y=Math.max(0,d.y)*0.4;d.normalize();pl.punchDir.copy(d);pl.dashT=pl.combo===2?0.15:0.11;pl.facing=Math.atan2(d.x,d.z);sfx('whoosh',pl.combo===2?1:0.7);}
function resolvePunch(){pl.punchDone=true;pl.bruteCone=0;const PS=Math.max(1,SIZE*HERO.scale),PR=Math.pow(PS,0.75);const c=pl.pos.clone();c.y+=1.2*PS;c.addScaledVector(pl.punchDir,2*PS);let hit=false;
 for(const e of enemies){if(e.dead)continue;const ec=new V3(e.pos.x,e.pos.y+e.cy,e.pos.z);if(ec.distanceTo(c)<3.2*PR+e.r){const up3=pl.combo===2;const k=pl.punchDir.clone().multiplyScalar(up3?(e.type==='drone'?40:20):(e.type==='drone'?36:12));k.y+=up3?34:(e.type==='drone'?4:0);damageEnemy(e,(up3?95:42)*ST.dmg*HERO.punch*(SIZE>1.5?3:SIZE<0.5?0.35:1),k.multiplyScalar(HERO_ID==='titan'?1.5:1));if(!up3&&e.type==='robot'&&!e.airborne){e.vel.set(0,0,0);e.pos.addScaledVector(pl.punchDir.clone().setY(0),0.6);}if(up3)e.stun=1.4;sparks(ec,16,14);fireBurst(ec,8,6,0.7);hit=true;}}
 for(const b of buildings){if(!b.alive)continue;if(boxDist(c,b.col)<2.6*PR){const pt=closestOnBox(c,b.col);damageBuilding(b,(HERO_ID==='brute'?99999:(pl.combo===2?220:120))*ST.dmg*HERO.punch*(SIZE>1.5?3:SIZE<0.5?0.35:1),pt,true);if(HERO_ID==='brute'&&!ARENA&&!pl.bruteCone){pl.bruteCone=1;let bn=0;const dir2=pl.punchDir.clone().setY(0).normalize();for(const ob of solidsNear(pl.pos.x,pl.pos.z).slice()){if(bn>=4||!ob.alive||ob===b)continue;const to=new V3(ob.x-pl.pos.x,0,ob.z-pl.pos.z);const dd=to.length();if(dd<34&&dd>1&&to.normalize().dot(dir2)>0.3){damageBuilding(ob,99999,closestOnBox(pl.pos,ob.col),true);bn++;}}}spawnDebris(pt,10,14,0.3,1.2,b.wallColor);hit=true;}}
 for(const pd of peds){if(pd.down>0)continue;if(Math.hypot(pd.x-c.x,pd.z-c.z)<2.6*PR&&c.y<3.5*PR){knockPed(pd,pl.punchDir,pl.combo===2?14:22);hit=true;}}
 for(const car of cars){if(car.state!==0)continue;if(Math.hypot(car.pos.x-c.x,car.pos.z-c.z)<3.6*PR&&c.y<car.pos.y+3.5*PR){launchCar(car,pl.punchDir.clone().multiplyScalar(45).setY(14));hit=true;}}
 if(hit){fxFlash(c,0.5,4.8,0.18,'#ffffff');fxFlash(c,1,8,0.14,'#ffffff',starTex);fxDome(c,0.3,3,0.26,new THREE.Color(energyHex()));ringFx(c,pl.punchDir,5,0.3,0xffffff);dustBurst(c,10,6,2,1.5,5,0.9);}else ringFx(c,pl.punchDir,2.2,0.25,0xdde8ff);
 if(hit){hitStop=Math.max(hitStop,pl.combo===2?0.11:0.05);if(pl.combo===2){addShake(0.2);sfx('punch',1);}addShake(0.35);sfx('punch');ringFx(c,pl.punchDir,3,0.25,0xffffff);}}
function tryShock(){if(pl.dead||pl.cd.shock>0||pl.en<35)return;pl.cd.shock=5;pl.en-=35;pl.shockT=time;const c=pl.pos.clone();c.y+=1;const R=SHOCK_R;
 const eh=energyHex(),ecol=new THREE.Color(eh);ringFx(c,UP,R,0.7,0x9fd4ff);ringFx(c,UP,R*0.7,0.5,0xffffff);dustBurst(pl.pos,46,25,3,2,7,1.5);fxGroundRing(pl.pos,1,R*1.15,0.75,eh);fxGroundRing(pl.pos,0.5,R*0.6,0.45,'#ffffff');fxDome(c,1,R*0.75,0.5,ecol);fxFlash(c,2,11,0.3,eh);fxFlash(c,2,14,0.2,'#ffffff',starTex);flashAt(c,8);
 for(let i=0;i<14;i++){const a=rand(0,6.283),rr=rand(3,8);spawnDebris(new V3(pl.pos.x+Math.cos(a)*rr,pl.pos.y+0.3,pl.pos.z+Math.sin(a)*rr),2,11,0.25,0.9,0x8a8678,1.4);}
 for(const e of enemies){if(e.dead)continue;const d=e.pos.distanceTo(pl.pos);if(d<R+e.r){const k=e.pos.clone().sub(pl.pos).setY(0).normalize().multiplyScalar(40);k.y=18;damageEnemy(e,70*ST.dmg*(1-d/(R+e.r)*0.5),k);}}
 for(const b of buildings){if(!b.alive)continue;const d=boxDist(c,b.col);if(d<R)damageBuilding(b,170*ST.dmg*(1-d/R),closestOnBox(c,b.col),true);}
 cityImpact(c,R,35);addShake(0.6);hitStop=Math.max(hitStop,0.05);sfx('shock');}
const SCORCH=600,scorchData=[];let scorchIdx=0,scorchT=0,laserPanicT=0;
const scorchI=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0x0b0907,alphaMap:cv(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);g.fillStyle='#000';g.fillRect(0,0,w,h);gr.addColorStop(0,'#fff');gr.addColorStop(0.5,'#bdbdbd');gr.addColorStop(1,'#000');g.fillStyle=gr;g.fillRect(0,0,w,h);},true),transparent:true,opacity:0.82,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),SCORCH);
scorchI.frustumCulled=false;scorchI.renderOrder=2;for(let i=0;i<SCORCH;i++)scorchI.setMatrixAt(i,ZM);scene.add(scorchI);
function addScorch(p,n,b){const i=scorchIdx;scorchIdx=(scorchIdx+1)%SCORCH;dm.position.copy(p).addScaledVector(n,0.05);dm.quaternion.setFromUnitVectors(new V3(0,0,1),n);dm.rotateZ(rand(0,6.28));const s=rand(0.9,1.6);dm.scale.set(s,s,1);dm.updateMatrix();scorchI.setMatrixAt(i,dm.matrix);scorchI.instanceMatrix.needsUpdate=true;scorchData[i]=b||null;dm.rotation.set(0,0,0);}
function clearScorch(b){let ch=false;for(let i=0;i<SCORCH;i++)if(scorchData[i]===b){scorchData[i]=null;scorchI.setMatrixAt(i,ZM);ch=true;}if(ch)scorchI.instanceMatrix.needsUpdate=true;}
function boxNormal(p,c){const dd=[[Math.abs(p.x-c.maxX),1,0,0],[Math.abs(p.x-c.minX),-1,0,0],[Math.abs(p.y-c.maxY),0,1,0],[Math.abs(p.z-c.maxZ),0,0,1],[Math.abs(p.z-c.minZ),0,0,-1]];dd.sort((a,b)=>a[0]-b[0]);return new V3(dd[0][1],dd[0][2],dd[0][3]);}
/* ---------- beam clash: opposing lasers stop each other at the meeting point ---------- */
const VBEAMS=new Map();let PBEAM=null,clashSndT=0;
function segClosest(p1,q1,p2,q2){const d1=q1.clone().sub(p1),d2=q2.clone().sub(p2),r=p1.clone().sub(p2);const a=d1.dot(d1),e2=d2.dot(d2),f=d2.dot(r),c=d1.dot(r),b=d1.dot(d2),den=a*e2-b*b;
 if(den<1e-4*a*e2){const pt=p1.clone().add(p2).multiplyScalar(0.5);const s=clamp(pt.clone().sub(p1).dot(d1)/a,0,1),t=clamp(pt.clone().sub(p2).dot(d2)/e2,0,1);const c1=p1.clone().addScaledVector(d1,s),c2=p2.clone().addScaledVector(d2,t);return {d:Math.max(c1.distanceTo(pt),c2.distanceTo(pt)),pt:c1.add(c2).multiplyScalar(0.5)};}
 let s=clamp((b*f-c*e2)/den,0,1),t=(b*s+f)/e2;if(t<0){t=0;s=clamp(-c/a,0,1);}else if(t>1){t=1;s=clamp((b-c)/a,0,1);}
 const c1=p1.clone().addScaledVector(d1,s),c2=p2.clone().addScaledVector(d2,t);return {d:c1.distanceTo(c2),pt:c1.add(c2).multiplyScalar(0.5)};}
function beamClash(self,o,end,w){let best=null,bd=1e9;
 const tryB=B=>{if(!B||time-B.t>0.12)return;const d1=end.clone().sub(o),d2=B.end.clone().sub(B.o),L1=d1.length(),L2=d2.length();if(L1<1||L2<1)return;if(d1.dot(d2)/(L1*L2)>-0.2)return;
  const R=segClosest(o,end,B.o,B.end);if(R.d>w+B.w+2.5)return;const dd=R.pt.distanceTo(o);if(dd<bd){bd=dd;best=R.pt;}};
 if(self!==pl)tryB(PBEAM);for(const [k,B] of VBEAMS)if(k!==self)tryB(B);
 const rec=(self===pl?PBEAM:VBEAMS.get(self))||{o:new V3(),end:new V3(),w:0,t:0};rec.o.copy(o);rec.end.copy(end);rec.w=w;rec.t=time;if(self===pl)PBEAM=rec;else VBEAMS.set(self,rec);
 if(best)clashFX(best,Math.max(w,1));return best;}
function clashFX(pt,w){sparks(pt,8,22,[1,0.9,0.6]);for(let k=0;k<4;k++)emit(glowPS,pt.x,pt.y,pt.z,rand(-8,8),rand(-4,8),rand(-8,8),rand(0.3,0.6),1.2+w*0.4,0.1,1,0.85,0.5,1,0.6,-4);flashAt(pt,3);
 if(time-clashSndT>0.35){clashSndT=time;sfxAt('zap',pt,500,0.9);if(pt.distanceTo(pl.pos)<80)addShake&&addShake(0.15);}}
function updateLaser(dt){for(const rb of ribbons){if(rb._mega){const a=time-rb._mega;if(a<0.35){rb.visible=true;rb.material.uniforms.inten.value=2*(1-a/0.35);}else{rb.visible=false;rb._mega=0;}}}
 const want=!PHOTO&&state==='play'&&mouseR&&pl.en>1&&!pl.dead&&!civOn&&(HERO.rmb==='eyes'||HERO.rmb==='hands'||HERO.rmb==='ice'||HERO.rmb==='megabeam');beams.forEach(b=>b.visible=false);
 if(want){if(laserT===0)sfx('charge',0.9);laserT+=dt;}else laserT=0;const charging=want&&laserT<0.14,firing=want&&!charging;pl.laser=firing;
 const lc=HERO.rmb==='ice'?new THREE.Color('#bfefff'):(HERO.rmb==='hands'||HERO.rmb==='megabeam'||HERO_ID==='void'||HERO_ID==='shrink')?new THREE.Color(costume.energy||'#3fe0cc'):new THREE.Color(LASER_COLS[laserColor]||LASER_COLS.kirmizi),boost=hdr();
 eyes.forEach((e,i)=>{const f=eyeFlares[i];f.a.visible=f.b.visible=want&&!FP;if(!want)return;const o=(HERO.rmb==='hands'||HERO.rmb==='ice')?[AL,AR][i].fist.getWorldPosition(new V3()):e.getWorldPosition(new V3());const k=charging?laserT/0.14:1,pulse=0.85+0.15*Math.sin(time*60+i*2);f.a.position.copy(o);f.b.position.copy(o);f.a.scale.setScalar((0.18+0.3*k)*pulse);f.b.scale.setScalar((0.3+0.55*k)*pulse);f.b.material.rotation=time*2;f.a.material.color.copy(lc).lerp(new THREE.Color(1,1,1),0.4).convertSRGBToLinear().multiplyScalar(boost);f.b.material.color.copy(f.a.material.color);});
 ribbons.forEach(r=>{r.visible=firing;});hitGlow.visible=firing;if(AC){laserG.gain.setTargetAtTime(firing?0.13:0,AC.currentTime,0.03);sizzleG.gain.setTargetAtTime(firing?0.5:0,AC.currentTime,0.05);}if(!firing)return;
 pl.en=Math.max(0,pl.en-18*dt);let tgt=aim.point;const _po=eyes[0].getWorldPosition(new V3()).add(eyes[1].getWorldPosition(new V3())).multiplyScalar(0.5);const _pcl=beamClash(pl,_po,tgt.clone(),0.35*(SIZE>1.5?SIZE*1.4:1)*(HERO.rmb==='megabeam'?1.2+LBLV*1.3:1));if(_pcl)tgt=_pcl;if(HERO.rmb==='megabeam'&&!_pcl)megaCutStep(dt);
 eyes.forEach((e,i)=>{const o=(HERO.rmb==='hands'||HERO.rmb==='ice')&&!FP?[AL,AR][i].fist.getWorldPosition(new V3()):FP?camera.position.clone().addScaledVector(camFwd,0.45).add(new V3(0,-0.14,0)).addScaledVector(new V3(-Math.cos(yaw),0,Math.sin(yaw)),i?0.06:-0.06):e.getWorldPosition(new V3());const r=ribbons[i];placeRibbon(r,o,tgt,(0.32+Math.random()*0.06)*(SIZE>1.5?SIZE*1.4:1)*(HERO.rmb==='megabeam'?1.2+LBLV*1.3:1));r.material.uniforms.time.value=time;r.material.uniforms.col.value.copy(lc);r.material.uniforms.inten.value=(1.1+0.25*Math.sin(time*70+i))*(boost>1?1.6:1);});
 hitGlow.position.copy(tgt);hitGlow.scale.setScalar((2.2+0.6*Math.sin(time*40))*(SIZE>1.5?SIZE*0.9:1));hitGlow.material.color.set(HERO.rmb==='ice'?0xbfefff:0xffb070).convertSRGBToLinear().multiplyScalar(boost*1.4);hitGlow.material.rotation=time*3;
 if(Math.random()<0.7)emit(glowPS,tgt.x,tgt.y,tgt.z,rand(-3,3),rand(2,6),rand(-3,3),rand(0.5,1),0.25,0.08,1,0.6,0.2,1,0.5,-16);
 sparks(tgt,3,9,[1,0.6,0.25]);if(Math.random()<0.4)emit(dustPS,tgt.x,tgt.y,tgt.z,rand(-1,1),rand(1,3),rand(-1,1),1.2,1,3,0.25,0.24,0.23,0.6,0.5,0);
 emit(glowPS,tgt.x,tgt.y,tgt.z,rand(-0.5,0.5),rand(0,1),rand(-0.5,0.5),0.25,1.6,2.6,1,0.5,0.15,1,2,0);flashAt(tgt,1.8);
 if(_pcl)return;
 laserPanicT-=dt;if(laserPanicT<=0){laserPanicT=0.5;panicAt(tgt);}
 if(HERO.rmb==='ice'){iceHit(dt);}
 else if(aim.ped){knockPed(aim.ped,camFwd,5);}
 else if(aim.car){aim.car.heat=(aim.car.heat||0)+dt;sparks(tgt,4,10,[1,0.7,0.3]);if(aim.car.heat>0.35)destroyCar(aim.car);}
 else if(aim.e){damageEnemy(aim.e,150*ST.dmg*dt*(SIZE>5?SIZE*0.04:1),null);}
 else{const b=aim.b;if(b){if(b.hp>b.maxHp*0.3)damageBuilding(b,150*ST.dmg*dt*(SIZE>5?SIZE*0.06:1),tgt.clone(),false,true);b.cut=(b.cut||[]).filter(q=>time-q.t<1.6);b.cut.push({p:tgt.clone(),t:time});
   if(b.cut.length>8){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9,y0=1e9,y1=-1e9,ys=0;for(const q of b.cut){x0=Math.min(x0,q.p.x);x1=Math.max(x1,q.p.x);z0=Math.min(z0,q.p.z);z1=Math.max(z1,q.p.z);y0=Math.min(y0,q.p.y);y1=Math.max(y1,q.p.y);ys+=q.p.y;}
    const span=Math.max(x1-x0,z1-z0);if(span>Math.min(b.w,b.d)*0.6&&y1-y0<5){const yc=ys/b.cut.length;b.cut=[];sliceBuilding(b,yc,camFwd);}}}
  moltenT-=dt;if(moltenT<=0){moltenT=0.018;addMolten(tgt,b?boxNormal(tgt,b.col):UP,b);}
  scorchT-=dt;if(scorchT<=0){scorchT=0.03;addScorch(tgt,b?boxNormal(tgt,b.col):UP,b);if(!b&&Math.random()<0.3)emit(dustPS,tgt.x,0.3,tgt.z,rand(-1,1),rand(1,3),rand(-1,1),1.6,1.5,4,0.22,0.21,0.2,0.6,0.5,0.3);}}}
/* ---------- devastating heat vision: molten trails, building slicing; fly-through holes ---------- */
const MOLTEN=420,moltenAge=new Float32Array(MOLTEN).fill(9),moltenData=[];let moltenIdx=0,moltenT=0;
const moltenI=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xffffff,alphaMap:radialMask(0.35),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5}),MOLTEN);
moltenI.frustumCulled=false;moltenI.renderOrder=3;{const c0=new THREE.Color(0,0,0);for(let i=0;i<MOLTEN;i++){moltenI.setMatrixAt(i,ZM);moltenI.setColorAt(i,c0);}}scene.add(moltenI);
const moltenType=new Uint8Array(MOLTEN);function addMolten(p,n,b,type){const i=moltenIdx;moltenIdx=(moltenIdx+1)%MOLTEN;dm.position.copy(p).addScaledVector(n,0.06);dm.quaternion.setFromUnitVectors(new V3(0,0,1),n);dm.rotateZ(rand(0,6.28));const s=rand(0.7,1.1);dm.scale.set(s,s,1);dm.updateMatrix();moltenI.setMatrixAt(i,dm.matrix);moltenI.instanceMatrix.needsUpdate=true;moltenAge[i]=0;moltenData[i]=b||null;moltenType[i]=type||0;dm.rotation.set(0,0,0);}
const _mc=new THREE.Color();
function updateMolten(dt){let ch=false;const boost=(typeof POST!=='undefined'&&POST.enabled)?3:1.2;for(let i=0;i<MOLTEN;i++){if(moltenAge[i]>4)continue;moltenAge[i]+=dt;const h=Math.max(0,1-moltenAge[i]/4);if(moltenType[i])_mc.setRGB(0.45*h*boost*0.6,0.7*h*boost*0.6,0.85*h*boost*0.6);else _mc.setRGB(1.0*h*boost,(0.35*h*h+0.05*h*h*h)*boost,0.05*h*h*h*boost);moltenI.setColorAt(i,_mc);if(moltenAge[i]>4)moltenI.setMatrixAt(i,ZM);ch=true;}if(ch){moltenI.instanceColor.needsUpdate=true;moltenI.instanceMatrix.needsUpdate=true;}}
const holeTex=cv(128,128,(g,w,h)=>{g.clearRect(0,0,w,h);const pts=[];for(let i=0;i<18;i++){const a=i/18*6.283,r=rand(38,58);pts.push([64+Math.cos(a)*r,64+Math.sin(a)*r]);}g.fillStyle='rgba(120,114,104,0.95)';g.beginPath();pts.forEach((q,i)=>{const x=64+(q[0]-64)*1.12,y=64+(q[1]-64)*1.12;i?g.lineTo(x,y):g.moveTo(x,y);});g.fill();g.fillStyle='#0a0a0c';g.beginPath();pts.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.fill();for(let i=0;i<40;i++){g.fillStyle='rgba(60,56,50,.9)';g.fillRect(rand(20,108),rand(20,108),rand(2,6),rand(2,6));}});
const HOLES=240,holeData=[];let holeIdx=0;
const holeI=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:holeTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6}),HOLES);holeI.frustumCulled=false;holeI.renderOrder=3;for(let i=0;i<HOLES;i++)holeI.setMatrixAt(i,ZM);scene.add(holeI);
function addHole(p,n,b,s){const i=holeIdx;holeIdx=(holeIdx+1)%HOLES;dm.position.copy(p).addScaledVector(n,0.08);dm.quaternion.setFromUnitVectors(new V3(0,0,1),n);dm.rotateZ(rand(0,6.28));dm.scale.set(s,s,1);dm.updateMatrix();holeI.setMatrixAt(i,dm.matrix);holeI.instanceMatrix.needsUpdate=true;holeData[i]=b;dm.rotation.set(0,0,0);}
function clearMarks(b){let c1=false,c2=false;for(let i=0;i<HOLES;i++)if(holeData[i]===b){holeData[i]=null;holeI.setMatrixAt(i,ZM);c1=true;}for(let i=0;i<MOLTEN;i++)if(moltenData[i]===b){moltenData[i]=null;moltenAge[i]=9;moltenI.setMatrixAt(i,ZM);c2=true;}if(c1)holeI.instanceMatrix.needsUpdate=true;if(c2)moltenI.instanceMatrix.needsUpdate=true;}
function rayBoxExit(o,d,c){let t1=1e9;for(const ax of['x','y','z']){const mn=ax==='x'?c.minX:ax==='y'?c.minY:c.minZ,mx=ax==='x'?c.maxX:ax==='y'?c.maxY:c.maxZ;if(Math.abs(d[ax])<1e-8)continue;let a=(mn-o[ax])/d[ax],bb=(mx-o[ax])/d[ax];if(a>bb){const q=a;a=bb;bb=q;}t1=Math.min(t1,bb);}return t1;}
/* fly straight through a building: holes on both sides, building stays up */
function punchThrough(b,vel){if(time-(b.lastPunch||-9)<0.8)return;b.lastPunch=time;const sp=vel.length()||1,dir=vel.clone().divideScalar(sp),o=pl.pos.clone();o.y+=1;const start=o.clone().addScaledVector(dir,-60);
 const t0=rayBox(start,dir,b.col,200),t1=rayBoxExit(start,dir,b.col);if(t0<0)return;const pin=start.clone().addScaledVector(dir,t0),pout=start.clone().addScaledVector(dir,Math.min(t1,200));
 for(const [pt,sgn] of[[pin,1],[pout,-1]]){const n=boxNormal(pt,b.col);addHole(pt,n,b,rand(3.2,4.2));spawnDebris(pt.clone().addScaledVector(n,0.5),14,14,0.25,1.2,b.wallColor);dustBurst(pt,10,6,2,2,6,1.3);sparks(pt,10,12);}
 b.shake=Math.min(0.5,b.shake+0.3);if(b.hp>b.maxHp*0.25)b.hp-=b.maxHp*0.04;sfxAt('boom',pin,260,0.55);addShake(0.25);hitStop=Math.max(hitStop,0.03);panicAt(pin);}
/* cut buildings in half with the laser */
const chunks=[];
function sliceBuilding(b,ycAbs,dir){const yc=ycAbs-(b.y0||0);if(yc<3||yc>b.h-2.5)return;const hTop=b.h-yc;let mats,geo;
 if(b.outer){mats=oMats[b.si];geo=new THREE.BoxGeometry(b.w,hTop,b.d);}else{mats=b.mesh.material;geo=b.cyl?cylBuildingGeo(Math.min(b.w,b.d)/2,hTop):buildingGeo(b.w,hTop,b.d);}
 const ch=new THREE.Mesh(geo,mats);ch.castShadow=ch.receiveShadow=true;const cy=(b.y0||0)+yc+hTop/2;ch.position.set(b.x,cy,b.z);scene.add(ch);
 const hd=new V3(dir.x,0,dir.z);if(hd.lengthSq()<1e-4)hd.set(1,0,0);hd.normalize();
 chunks.push({m:ch,vel:hd.clone().multiplyScalar(1.5),axis:new V3().crossVectors(UP,hd).normalize(),ang:0,av:0.15,t:0,h:hTop,w:Math.max(b.w,b.d),color:b.wallColor});
 clearMarks(b);clearScorch(b);b.h=yc;b.col.maxY=(b.y0||0)+yc;b.hp=Math.max(b.hp,b.maxHp*0.3);
 if(b.outer){b.gable=false;oSet(b,true);}else{for(const c of[...b.mesh.children])b.mesh.remove(c);b.mesh.geometry=b.cyl?cylBuildingGeo(Math.min(b.w,b.d)/2,yc):buildingGeo(b.w,yc,b.d);b.mesh.position.set(b.x,(b.y0||0)+yc/2,b.z);for(const k of b.kids)if(k.alive)collapseBuilding(k);}
 const cutP=new V3(b.x,ycAbs,b.z);for(let i=0;i<26;i++)emit(glowPS,b.x+rand(-b.w/2,b.w/2),ycAbs,b.z+rand(-b.d/2,b.d/2),rand(-2,2),rand(0,3),rand(-2,2),rand(0.5,1.2),0.5,0.15,1,0.6,0.2,1,0.5,-12);
 sfxAt('collapse',cutP,500,0.8);addShakeAt(cutP,0.5);prog.destroyed++;addXP(25,'Bina ikiye kesildi');}
function updateChunks(dt){for(let i=chunks.length-1;i>=0;i--){const c=chunks[i];c.t+=dt;c.av+=dt*(0.9+c.t*0.6);c.ang=Math.min(c.ang+c.av*dt,1.5);
 const q=new THREE.Quaternion().setFromAxisAngle(c.axis,c.av*dt);if(c.ang<1.5)c.m.quaternion.premultiply(q);
 if(c.t>0.35)c.vel.y+=G*0.7*dt;c.m.position.addScaledVector(c.vel,dt);if(Math.random()<0.4)emit(dustPS,c.m.position.x+rand(-c.w/2,c.w/2),c.m.position.y-c.h/2,c.m.position.z+rand(-c.w/2,c.w/2),rand(-1,1),rand(-2,0),rand(-1,1),1.5,2,6,0.62,0.58,0.52,0.6,0.5,0.2);
 if(c.m.position.y<c.h*0.35||c.t>7){const p=c.m.position.clone();p.y=Math.max(1,p.y*0.3);spawnDebris(p,40,18,0.6,2.6,c.color,0.8);for(let k=0;k<26;k++){const a=rand(0,6.283),r=rand(2,c.w);dustBurst(new V3(p.x+Math.cos(a)*r,1,p.z+Math.sin(a)*r),1,10,2,4,11,2.6);}
  cityImpact(new V3(p.x,0,p.z),c.w*0.8,18);sfxAt('collapse',p,520,1);addShakeAt(p,0.9);scene.remove(c.m);c.m.geometry.dispose();chunks.splice(i,1);}}}

function hitMarker(){if(time-hitMarkT<0.08)return;hitMarkT=time;const h=$('hitM');h.classList.remove('on');void h.offsetWidth;h.classList.add('on');}

/* ---------- enemies ---------- */
const enemies=[];
const panelN=normalMapFrom(mkc(128,128,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);g.fillStyle='#7a7a7a';g.fillRect(0,0,w,3);g.fillRect(0,0,3,h);g.fillRect(0,62,w,2);g.fillRect(70,0,2,62);g.fillStyle='#aaa';for(const [x,y] of[[10,10],[118,10],[10,54],[118,54],[20,90],[108,118]]){g.beginPath();g.arc(x,y,3,0,6.3);g.fill();}}),2.5);
const eMetal=M(0x2c3038,0.32,{metalness:0.85,normalMap:panelN}),eMetal2=M(0x4a505a,0.38,{metalness:0.7,normalMap:panelN}),eEye=new THREE.MeshStandardMaterial({color:lin(0xff3b30),emissive:lin(0xff2a1a),emissiveIntensity:2.2}),bossArmor=M(0x6b1f24,0.35,{metalness:0.7,normalMap:panelN}),eGun=M(0x1b1d22,0.4,{metalness:0.8});
const GD={body:new THREE.SphereGeometry(0.7,16,12),ring:new THREE.TorusGeometry(1.1,0.12,8,24),eye:new THREE.SphereGeometry(0.26,10,8),rotor:new THREE.BoxGeometry(0.8,0.05,0.14),gun:new THREE.CylinderGeometry(0.1,0.12,0.8,8)};
function buildDrone(){const g=new THREE.Group();const b=new THREE.Mesh(GD.body,eMetal),r=new THREE.Mesh(GD.ring,eMetal2),e=new THREE.Mesh(GD.eye,eEye);r.rotation.x=Math.PI/2;e.position.z=0.6;g.add(b,r,e);const rotors=[];for(let a=0;a<4;a++){const ro=new THREE.Mesh(GD.rotor,eGun),an=a*Math.PI/2+Math.PI/4;ro.position.set(Math.cos(an)*1.1,0.15,Math.sin(an)*1.1);g.add(ro);rotors.push(ro);}g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return{g,rotors};}
function buildRobot(boss){const g=new THREE.Group(),arm=boss?bossArmor:eMetal;const bx=(w,h,d,m,x,y,z,p)=>{const me=new THREE.Mesh(rbox(w,h,d,Math.min(w,h,d)*0.22),m);me.position.set(x,y,z);me.castShadow=true;(p||g).add(me);return me;};
 bx(1.5,1.4,0.95,arm,0,2.3,0);bx(1.1,0.5,0.8,eMetal2,0,1.45,0);bx(0.8,0.6,0.7,arm,0,3.3,0);bx(0.62,0.14,0.05,eEye,0,3.33,0.36);
 const legs=[],arms=[],muzzles=[];for(const s of[-1,1]){const lg=new THREE.Group();lg.position.set(s*0.42,1.4,0);g.add(lg);bx(0.48,1.4,0.55,eMetal2,0,-0.7,0,lg);bx(0.55,0.2,0.8,eGun,0,-1.35,0.1,lg);legs.push(lg);
  const am=new THREE.Group();am.position.set(s*1.0,2.8,0);g.add(am);bx(0.42,1.1,0.42,arm,0,-0.55,0,am);const gun=new THREE.Mesh(GD.gun,eGun);gun.position.set(0,-1.3,0);gun.castShadow=true;am.add(gun);const mz=new THREE.Object3D();mz.position.set(0,-1.75,0);am.add(mz);arms.push(am);muzzles.push(mz);}
 if(boss){bx(0.7,0.7,1.2,eGun,-1.2,3.4,-0.1);bx(0.7,0.7,1.2,eGun,1.2,3.4,-0.1);}
 return{g,legs,arms,muzzles};}
function spawnEnemy(type,pos,tag){let e;
 if(type==='drone'){const b=buildDrone();e={g:b.g,rotors:b.rotors,hp:45,r:1.3,cy:0,speed:16,cd:rand(1,2.5)};}
 else{const boss=type==='boss',b=buildRobot(boss);if(boss)b.g.scale.setScalar(3.2);e={g:b.g,legs:b.legs,arms:b.arms,muzzles:b.muzzles,hp:boss?1800:90,r:boss?5:1.5,cy:boss?6:2.1,speed:boss?4.5:7,cd:rand(1.5,3),cd2:3,cd3:5,volley:0,volleyT:0};}
 Object.assign(e,{type,maxHp:e.hp,pos:pos.clone(),vel:new V3(),dead:false,tag:tag||null,airborne:false,knock:0,walkPh:0,t:0,seed:rand(0,100),mz:0});e.g.position.copy(e.pos);scene.add(e.g);enemies.push(e);return e;}
function damageEnemy(e,dmg,knock){if(e.dead)return;if(e.phase){const c=new V3(e.pos.x,e.pos.y+e.cy,e.pos.z);fxFlash(c,0.4,2.5,0.12,'#cfefff');return;}e.hp-=dmg;hitMarker();e.hitT=0.2;e.tele=0;if(e.type!=='drone'&&time-clangT>0.08){clangT=time;sfxAt('clang',e.pos,160,0.8);}
 if(knock){if(e.type==='boss'||e.type==='villain'){}else if(e.type==='drone'){e.vel.add(knock);e.knock=0.8;}else if(knock.length()>8){e.vel.copy(knock);e.airborne=true;}}
 if(e.hp<=0)killEnemy(e);}
function killEnemy(e){e.dead=true;scene.remove(e.g);const boss=e.type==='boss'||e.type==='villain';const c=e.pos.clone();c.y+=e.cy;
 fireBurst(c,boss?140:35,boss?26:12,boss?3:1);dustBurst(c,boss?40:10,8,3,2,6,1.2,[0.25,0.25,0.27]);spawnDebris(c,boss?40:8,14,0.3,boss?2:0.8,0x2c3038,1);flashAt(c,boss?10:4);sfxAt('boom',c,300,boss?1.2:0.7);addShakeAt(c,boss?1:0.3);
 if(boss){cityImpact(c,20,30);ringFx(c,UP,30,1,0xffa060);for(const b of buildings){if(!b.alive)continue;const d=boxDist(c,b.col);if(d<18)damageBuilding(b,260*(1-d/18),closestOnBox(c,b.col),true);}}
 addMoney(boss?2500:e.type==='robot'?60:40);addXP(boss?400:e.type==='robot'?25:15,boss?'Dev mekanik yok edildi':e.type==='robot'?'Robot yok edildi':'Drone düşürüldü');
 if(ev&&e.tag===ev.id)ev.kills++;}
function enemyShoot(from,dmg,speed){const tgt=new V3(pl.pos.x,pl.pos.y+1.2*HERO.scale*SIZE,pl.pos.z);const dist=tgt.distanceTo(from);tgt.addScaledVector(pl.vel,dist/speed*0.5);const dir=tgt.sub(from).normalize();spawnProj({kind:'bolt',pos:from,vel:dir.multiplyScalar(speed),size:0.3,mat:boltMat,life:3,dmg,owner:1});sfxAt('enemyShot',from,160);}
function updateEnemies(dt){for(const e of enemies){if(e.dead)continue;e.t+=dt;const toP=new V3(pl.pos.x-e.pos.x,pl.pos.y+1.2-(e.pos.y+e.cy),pl.pos.z-e.pos.z);const dist=toP.length();
  if(e.type==='villain'){VIL_HURT=AG().dmg;updVillain(e,dt);VIL_HURT=1;}else if(e.type==='drone')updDrone(e,dt,toP,dist);else updWalker(e,dt,toP,dist);if(!e.dead)e.g.position.copy(e.pos);
  if(!e.dead&&!e.tag&&dist>650){e.dead=true;scene.remove(e.g);}}
 for(let i=enemies.length-1;i>=0;i--)if(enemies[i].dead)enemies.splice(i,1);}
function updDrone(e,dt,toP,dist){if(e.stun>0){e.stun-=dt;if(Math.random()<0.3)emit(glowPS,e.pos.x+rand(-0.8,0.8),e.pos.y+rand(-0.5,0.8),e.pos.z+rand(-0.8,0.8),0,-0.5,0,0.5,0.3,0.1,0.8,0.94,1,1,0,0);return;}e.rotors.forEach(r=>r.rotation.y+=dt*30);
 if(e.knock>0){e.knock-=dt;e.vel.multiplyScalar(1-1.2*dt);e.vel.y-=8*dt;}
 else{const a=e.t*0.6+e.seed;const tgt=new V3(pl.pos.x+Math.sin(a)*14,pl.pos.y+6+Math.sin(e.t*1.3+e.seed)*3,pl.pos.z+Math.cos(a)*14);const d=tgt.sub(e.pos),L=d.length()||1;e.vel.lerp(d.multiplyScalar(Math.min(e.speed,L*1.5)/L),damp(2.5,dt));}
 e.pos.addScaledVector(e.vel,dt);
 for(const b of buildings){if(!b.alive)continue;const c=b.col;if(e.pos.x>c.minX-1&&e.pos.x<c.maxX+1&&e.pos.z>c.minZ-1&&e.pos.z<c.maxZ+1&&e.pos.y<c.maxY+1.5){const sp=e.vel.length();if(e.knock>0&&sp>18){damageBuilding(b,sp*3*ST.dmg,e.pos.clone(),true);damageEnemy(e,999,null);return;}e.pos.y=c.maxY+1.5;if(e.vel.y<0)e.vel.y=0;}}
 if(e.pos.y<2){if(e.knock>0&&e.vel.y<-12){damageEnemy(e,999,null);return;}e.pos.y=2;e.vel.y=Math.max(0,e.vel.y);}
 e.g.lookAt(pl.pos.x,pl.pos.y+1.2,pl.pos.z);
 if(e.hitT>0){e.hitT-=dt;e.pos.x+=rand(-0.06,0.06);e.pos.y+=rand(-0.06,0.06);}
 e.cd-=dt;if(e.tele>0){e.tele-=dt;const mz=e.pos.clone().addScaledVector(toP,0.9/dist);emit(glowPS,mz.x,mz.y,mz.z,0,0,0,0.12,0.4+0.9*(1-e.tele/0.45),0.3,1,0.15,0.1,1,0,0);if(e.tele<=0&&!pl.dead)enemyShoot(e.pos.clone().addScaledVector(toP,1.2/dist),6,45);}
 else if(e.cd<=0&&dist<75&&e.knock<=0&&!pl.dead){e.cd=rand(1.8,2.8);e.tele=0.45;sfxAt('charge',e.pos,120,0.35);}}
function updWalker(e,dt,toP,dist){const boss=e.type==='boss';
 if(e.airborne){e.vel.y+=G*dt;e.pos.addScaledVector(e.vel,dt);e.g.rotation.x+=dt*6;
  for(const b of buildings){if(!b.alive)continue;const c=b.col;if(e.pos.y>=c.maxY||e.pos.x<c.minX-e.r||e.pos.x>c.maxX+e.r||e.pos.z<c.minZ-e.r||e.pos.z>c.maxZ+e.r)continue;const sp=e.vel.length();
   if(sp>14){damageBuilding(b,sp*3*ST.dmg,e.pos.clone().setY(e.pos.y+e.cy),true);damageEnemy(e,sp*0.8,null);if(e.dead)return;}pushBoxXZ(e.pos,null,e.r,c);e.vel.x*=-0.3;e.vel.z*=-0.3;}
  const gy=groundAt(e.pos.x,e.pos.y,e.pos.z,e.r*0.5);if(e.pos.y<=gy){e.pos.y=gy;if(e.vel.y<-22){dustBurst(e.pos,10,5,1,1.5,4,0.9);damageEnemy(e,-e.vel.y*0.6,null);if(e.dead)return;}e.vel.set(0,0,0);e.airborne=false;e.g.rotation.x=0;}
  return;}
 if(e.hitT>0)e.hitT-=dt;e.g.rotation.x=e.hitT>0?-0.35*(e.hitT/0.2)*(boss?0.2:1):0;
 if(e.stun>0){e.stun-=dt;if(Math.random()<0.5){const a=time*8+Math.random();emit(glowPS,e.pos.x+Math.cos(a)*0.6*(boss?3:1),e.pos.y+e.cy*1.75,e.pos.z+Math.sin(a)*0.6*(boss?3:1),0,0.5,0,0.4,0.35,0.15,1,0.9,0.3,1,0,0);}e.legs[0].rotation.x=e.legs[1].rotation.x=0;return;}
 const flat=Math.hypot(toP.x,toP.z)||1e-3;e.g.rotation.y=turnAngle(e.g.rotation.y,Math.atan2(toP.x,toP.z),damp(boss?2:6,dt));
 const stop=boss?10:(dist<25?12:4);let moving=false;
 if(flat>stop&&!pl.dead){e.pos.x+=toP.x/flat*e.speed*dt;e.pos.z+=toP.z/flat*e.speed*dt;moving=true;}
 for(const b of buildings){if(!b.alive)continue;const c=b.col;if(e.pos.y>=c.maxY-0.5)continue;if(e.pos.x<c.minX-e.r||e.pos.x>c.maxX+e.r||e.pos.z<c.minZ-e.r||e.pos.z>c.maxZ+e.r)continue;if(boss&&pushBoxXZ(_v1.copy(e.pos),null,e.r,c)){damageBuilding(b,260*dt,closestOnBox(e.pos.clone().setY(3),c),true,true);}pushBoxXZ(e.pos,null,e.r,c);}
 const gy=groundAt(e.pos.x,e.pos.y,e.pos.z,e.r*0.5);if(e.pos.y>gy+0.3)e.airborne=true;else e.pos.y=gy;
 if(moving)e.walkPh+=dt*(boss?3:7);const sw=moving?Math.sin(e.walkPh)*0.5:0;e.legs[0].rotation.x=sw;e.legs[1].rotation.x=-sw;
 const aiming=dist<(boss?90:60);const ax=-(Math.PI/2+clamp(Math.atan2(toP.y,flat),-0.8,1.2));e.arms.forEach(a=>{a.rotation.x=lerp(a.rotation.x,aiming?ax:0,damp(6,dt));});
 if(pl.dead)return;e.cd-=dt;
 if(!boss){if(e.tele>0){e.tele-=dt;if(e.teleMelee){e.arms.forEach(a=>{a.rotation.x=lerp(a.rotation.x,-2.6,damp(12,dt));});if(e.tele<=0){if(dist<3.6){hurt(10);pl.vel.add(toP.clone().normalize().multiplyScalar(12));sfx('punch',0.6);}else sfxAt('whoosh',e.pos,80,0.5);}}
   else{const mz=e.muzzles[e.mz].getWorldPosition(new V3());emit(glowPS,mz.x,mz.y,mz.z,0,0,0,0.12,0.35+0.8*(1-e.tele/0.5),0.25,1,0.15,0.1,1,0,0);if(e.tele<=0)enemyShoot(mz,7,48);}}
  else if(dist<3.4&&e.cd<=0){e.cd=1.5;e.tele=0.35;e.teleMelee=true;}
  else if(aiming&&e.cd<=0){e.cd=rand(1.9,2.9);e.mz=1-e.mz;e.tele=0.5;e.teleMelee=false;sfxAt('charge',e.pos,120,0.35);}}
 else{e.cd2-=dt;e.cd3-=dt;
  if(e.stompT>0){e.stompT-=dt;e.g.position.y+=0;if(e.stompT<=0){e.cd2=4.5;const c=e.pos.clone();c.y+=0.5;ringFx(c,UP,22,0.8,0xff8a5c);dustBurst(e.pos,50,22,2,3,7,1.5);sfxAt('shock',c,300,1);addShakeAt(c,0.6);
   if(dist<22&&pl.pos.y<e.pos.y+5){hurt(22);const k=toP.clone().setY(0).normalize().multiplyScalar(25);k.y=12;pl.vel.add(k);pl.grounded=false;}}}
  else if(e.cd2<=0&&dist<22){e.stompT=0.85;e.cd2=99;fxGroundRing(e.pos,4,22,0.85,'#ff3b30');fxGroundRing(e.pos,2,10,0.6,'#ff8a5c');sfxAt('alert',e.pos,200,0.8);}
  if(e.cd3<=0&&dist<150){e.cd3=7;e.volley=6;e.volleyT=0.6;sfxAt('charge',e.pos,260,0.8);}
  if(e.volley>0&&e.volleyT>0.2){for(const s2 of[-1,1]){const sh=e.pos.clone().add(new V3(Math.cos(e.g.rotation.y)*s2*3.8,11.5,-Math.sin(e.g.rotation.y)*s2*3.8));emit(glowPS,sh.x,sh.y,sh.z,rand(-1,1),rand(0,2),rand(-1,1),0.25,1.2,0.4,1,0.55,0.15,1,0,0);}}
  if(e.volley>0){e.volleyT-=dt;if(e.volleyT<=0){e.volleyT=0.2;e.volley--;const s=e.volley%2?1:-1;const from=e.pos.clone().add(new V3(Math.cos(e.g.rotation.y)*s*3.8,11.5,-Math.sin(e.g.rotation.y)*s*3.8));spawnProj({kind:'missile',pos:from,vel:new V3(rand(-4,4),18,rand(-4,4)),size:0.55,mat:missileMat,life:7,dmg:12,owner:1});sfxAt('enemyShot',from,200,1.4);}}
  if(aiming&&e.cd<=0){e.cd=1.4;e.mz=1-e.mz;enemyShoot(e.muzzles[e.mz].getWorldPosition(new V3()),8,55);}}}

/* ---------- events ---------- */
let ev=null,nextEventAt=14,evId=0,ambientT=8;
const beaconGeo=new THREE.CylinderGeometry(2.5,2.5,400,20,1,true),ringTorus=new THREE.TorusGeometry(6,0.5,10,40);
function makeBeacon(p,color){const m=new THREE.Mesh(beaconGeo,new THREE.MeshBasicMaterial({color:lin(color),transparent:true,opacity:0.22,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));m.position.set(p.x,200,p.z);scene.add(m);return m;}
function roadPoint(from,minD,maxD){for(let k=0;k<30;k++){const a=rand(0,6.283),d=rand(minD,maxD);let x=clamp(from.x+Math.cos(a)*d,-HALF+10,HALF-10),z=clamp(from.z+Math.sin(a)*d,-HALF+10,HALF-10);if(Math.random()<.5)x=-HALF+Math.round((x+HALF)/PITCH)*PITCH;else z=-HALF+Math.round((z+HALF)/PITCH)*PITCH;const p=new V3(x,0,z);if(p.distanceTo(from)>=minD*0.7)return p;}return new V3(-HALF+PITCH,0,-HALF+PITCH);}
function roadSpread(c,spread){const mx=((c.x+HALF)%PITCH+PITCH)%PITCH,onX=mx<1||mx>PITCH-1;const a=rand(-spread,spread),b=rand(-4,4);return onX?new V3(c.x+b,0,c.z+a):new V3(c.x+a,0,c.z+b);}
function buildRace(start){const pts=[];let p=new V3(start.x,rand(35,60),start.z),h=rand(0,6.283);pts.push(p.clone());
 for(let i=1;i<8;i++){h+=rand(-0.8,0.8);let q=new V3(p.x+Math.sin(h)*rand(55,85),clamp(p.y+rand(-18,22),25,140),p.z+Math.cos(h)*rand(55,85));if(Math.abs(q.x)>HALF-30||Math.abs(q.z)>HALF-30){h=Math.atan2(-p.x,-p.z)+rand(-0.4,0.4);q=new V3(p.x+Math.sin(h)*70,clamp(p.y+rand(-10,15),25,140),p.z+Math.cos(h)*70);}pts.push(q);p=q;}
 return pts.map((pt,i)=>{const m=new THREE.Mesh(ringTorus,glowMat(0xffd24a));m.position.copy(pt);m.lookAt(i<pts.length-1?pts[i+1]:pts[i-1]);scene.add(m);return m;});}
function startEvent(){const types=['attack','race','heist'];if(prog.level>=3||prog.events>=2)types.push('boss');const type=pick(types),c=roadPoint(pl.pos,110,220);
 ev={id:++evId,type,center:c,kills:0,total:0,timer:0,timerOn:false,reward:0,rings:null,ri:0,beacon:null,name:'',desc:''};
 if(type==='attack'){ev.name='Robot saldırısı';ev.desc='Şehre saldıran robotları durdur';ev.reward=180;for(let i=0;i<6;i++)spawnEnemy('robot',roadSpread(c,22),ev.id);for(let i=0;i<4;i++)spawnEnemy('drone',roadSpread(c,15).setY(rand(20,35)),ev.id);ev.total=10;ev.beacon=makeBeacon(c,0xff5a3a);}
 else if(type==='heist'){ev.name='Banka soygunu';ev.desc='Soyguncu robotları süre dolmadan etkisiz hale getir';ev.reward=220;ev.timer=100;ev.timerOn=true;for(let i=0;i<5;i++)spawnEnemy('robot',roadSpread(c,14),ev.id);for(let i=0;i<2;i++)spawnEnemy('drone',roadSpread(c,10).setY(25),ev.id);ev.total=7;ev.beacon=makeBeacon(c,0xe8b923);}
 else if(type==='race'){ev.name='Hız challenge';ev.desc='Altın halkalardan süre bitmeden geç';ev.reward=160;ev.rings=buildRace(c);ev.total=ev.rings.length;ev.timer=55;ev.beacon=makeBeacon(ev.rings[0].position,0xffd24a);}
 else{ev.name='Dev mekanik';ev.desc='Dev savaş robotu şehri yerle bir ediyor';ev.reward=500;spawnEnemy('boss',c,ev.id);ev.total=1;ev.beacon=makeBeacon(c,0xff3030);}
 banner(ev.name,ev.desc);sfx('alert');}
function evTarget(){if(ev.type==='race'&&ev.rings[ev.ri])return ev.rings[ev.ri].position;if(ev.type==='boss'){const b=enemies.find(e=>e.tag===ev.id&&!e.dead);if(b)return b.pos;}return ev.center;}
function updateEvent(dt){if(!ev){return;}
 if(ev.beacon){ev.beacon.material.opacity=0.16+0.08*Math.sin(time*3);if(ev.type==='boss'){const t=evTarget();ev.beacon.position.set(t.x,200,t.z);}}
 if(ev.type==='race'){const chest=new V3(pl.pos.x,pl.pos.y+1,pl.pos.z);ev.rings.forEach((m,i)=>{m.material.opacity=i===ev.ri?0.95:0.25;const s=i===ev.ri?1+0.08*Math.sin(time*6):1;m.scale.set(s,s,s);});
  const r=ev.rings[ev.ri];if(chest.distanceTo(r.position)<6.5){sfx('ring');sparks(r.position,24,12,[1,0.85,0.3]);scene.remove(r);ev.ri++;if(ev.ri===1)ev.timerOn=true;else ev.timer+=4;if(ev.ri>=ev.rings.length){endEvent(true);return;}const n=ev.rings[ev.ri].position;ev.beacon.position.set(n.x,200,n.z);}}
 if(ev.timerOn){ev.timer-=dt;if(ev.timer<=0){endEvent(false);return;}}
 if(ev.type!=='race'&&ev.kills>=ev.total)endEvent(true);}
function endEvent(ok){if(ev.beacon){scene.remove(ev.beacon);ev.beacon.material.dispose();}if(ev.rings)ev.rings.forEach(m=>{scene.remove(m);m.material.dispose();});for(const e of enemies)if(e.tag===ev.id)e.tag=null;
 const name=ev.name,reward=ev.reward;ev=null;nextEventAt=time+rand(15,25);
 if(ok){prog.events++;addMoney(reward*4,'Görev ödülü');addXP(reward,'Görev tamamlandı');banner('Görev tamamlandı',name);sfx('level',0.6);}else banner('Görev başarısız','Bir sonraki olayda daha hızlı ol');saveDirty=true;}
function updateAmbient(dt){return;ambientT-=dt;if(ambientT>0)return;ambientT=rand(9,14);let n=0;for(const e of enemies)if(!e.tag&&!e.dead)n++;if(n>=3+Math.min(prog.level,6))return;
 if(Math.random()<0.55){const c=roadPoint(pl.pos,90,140);for(let i=0;i<2;i++)spawnEnemy('drone',roadSpread(c,10).setY(rand(25,45)));}else{const c=roadPoint(pl.pos,70,110);for(let i=0;i<2;i++)spawnEnemy('robot',roadSpread(c,12));}}

/* ---------- progression helpers ---------- */
function addXP(n,label){prog.xp+=n;toast('+'+n+' XP',label);while(prog.xp>=xpNeed(prog.level)){prog.xp-=xpNeed(prog.level);prog.level++;prog.points++;levelUp();}saveDirty=true;}
function levelUp(){ST=stats();pl.hp=ST.maxHp;pl.en=ST.maxEn;const l=prog.level;banner('Seviye '+l,l===2?'Şok dalgası açıldı. Q ile kullan.':'Bir geliştirme puanı kazandın. Tab ile harca.');sfx('level');}
function toast(t,sub){const el=document.createElement('div');el.className='toast slant';const b=document.createElement('b');b.textContent=t;const s=document.createElement('span');s.textContent=sub?' '+sub:'';el.append(b,s);const box=$('toasts');box.prepend(el);while(box.children.length>5)box.lastChild.remove();setTimeout(()=>el.remove(),2700);}
function banner(t,s){$('bT').textContent=t;$('bS').textContent=s||'';const b=$('banner');b.classList.remove('on');void b.offsetWidth;b.classList.add('on');}
let dmgFlash=0,GRABBED=null,grabT=0;
function updateGrab(dt){if(!GRABBED)return;const e=GRABBED;if(e.dead||pl.dead){GRABBED=null;return;}const S=HEROES[e.vid].scale*(e.size||1);
 const hand=new V3(e.pos.x+Math.sin(e.face)*e.r*0.9,e.pos.y+e.cy*1.4,e.pos.z+Math.cos(e.face)*e.r*0.9);
 pl.pos.lerp(hand,Math.min(1,dt*12));pl.vel.set(0,0,0);grabT-=dt;
 if(PHASE_ON){GRABBED=null;return;}
 if(grabT<=0){const dir=new V3(Math.sin(e.face),0,Math.cos(e.face));const thr=dir.multiplyScalar(90).add(new V3(0,42,0));pl.vel.copy(thr);pl.pos.addScaledVector(dir,2);hurt(18);sfxAt('whoosh',e.pos,300,1);addShake(0.5);GRABBED=null;}}
function hurt(n){if(pl.dead||state!=='play')return;n*=VIL_HURT;if(SIZE>1.5){return;}if(PHASE_ON){phaseDodge();return;}pl.hp-=n;pl.hurtT=time;dmgFlash=Math.min(1,dmgFlash+n/25);addShake(n/60);sfx('hurt');if(pl.hp<=0){pl.hp=0;die();}}
function die(){pl.dead=true;pl.flying=false;pl.flyMax=ST.fly;pl.mach=0;pl.boosting=false;pl.deathT=3;$('dead').classList.remove('hidden');fireBurst(new V3(pl.pos.x,pl.pos.y+1,pl.pos.z),20,6);}
function respawn(){pl.dead=false;pl.pos.copy(SPAWN);pl.vel.set(0,0,0);pl.hp=ST.maxHp;pl.en=ST.maxEn;pl.grounded=true;pl.flying=false;pl.tilt=0;$('dead').classList.add('hidden');camPivot.set(SPAWN.x,1.6,SPAWN.z);}

/* ---------- hero animation ---------- */
const HA={ph:0,aw:0,fw:0,bw:0,cruise:0,capeA:0.1,shootW:0,punchW:0,shockW:0,restT:0,sitW:0,lieW:0,restMode:0};
function mixP(a,b,k){const o={};for(const n in a)o[n]=a[n]+(b[n]-a[n])*k;return o;}
function pLoco(s,sup,t){const wk=clamp(s,0,1),rn=clamp(s-1,0,1),id=1-wk,sn=Math.sin(HA.ph),cs=Math.cos(HA.ph),amp=0.45*wk+0.35*rn,kb=0.6*wk+1.0*rn+0.3*sup,br=Math.sin(t*1.8),az=0.14*id+0.08+id*br*0.02;
 return{hy:0.95-0.03*rn-0.05*sup+Math.abs(cs)*(0.025*wk+0.04*rn)+id*br*0.005,lean:-0.05*id+0.06*wk+0.22*rn+0.25*sup,hd:0.04*id-0.2*sup,tL:-sn*amp-0.04*id,tR:sn*amp+0.04*id,kL:0.05+Math.max(0,cs)*kb,kR:0.05+Math.max(0,-cs)*kb,aL:sn*amp*(0.9-0.5*sup)+0.5*sup,aR:-sn*amp*(0.9-0.5*sup)+0.5*sup,eL:-(0.2+0.2*wk+0.9*rn),eR:-(0.2+0.2*wk+0.9*rn),zL:az,zR:az};}
function pAir(vy){const f=clamp(-vy/12,0,1);return{hy:0.95,lean:0.1-0.12*f,hd:0,tL:-0.8+0.45*f,tR:0.15,kL:1.2-0.5*f,kR:0.5,aL:-0.5+0.3*f,aR:0.3,eL:-0.6,eR:-0.6,zL:0.35+0.55*f,zR:0.35+0.55*f};}
function pHover(t){return{hy:0.95+Math.sin(t*2)*0.02,lean:0.02,hd:0,tL:-0.15+Math.sin(t*1.7)*0.06,tR:0.05-Math.sin(t*1.7)*0.06,kL:0.45,kR:0.2,aL:-0.15,aR:-0.15,eL:-0.5,eR:-0.5,zL:0.4,zR:0.4};}
function pCruise(){return{hy:0.95,lean:0,hd:-0.35,tL:0.04,tR:0.08,kL:0.12,kR:0.2,aL:0.25,aR:0.25,eL:-0.2,eR:-0.2,zL:0.12,zR:0.12};}
function pBoost(){return{hy:0.95,lean:0,hd:-0.9,tL:0.03,tR:0.03,kL:0.06,kR:0.06,aL:0.2,aR:-3.05,eL:-0.15,eR:-0.02,zL:0.08,zR:0.02};}
function animateHero(dt){rig.scale.setScalar(1.04*HERO.scale*SIZE);updatePhase(dt);if(typeof animateWings==='function')animateWings(dt);const hs=Math.hypot(pl.vel.x,pl.vel.z),sp=pl.vel.length(),inAir=!pl.flying&&!pl.grounded&&!pl.dead;
 HA.aw+=((inAir?1:0)-HA.aw)*damp(12,dt);HA.fw+=((pl.flying?1:0)-HA.fw)*damp(8,dt);HA.bw+=((pl.boosting&&sp>40?1:0)-HA.bw)*damp(5,dt);HA.cruise+=(clamp((sp-3)/(ST.fly-3),0,1)-HA.cruise)*damp(5,dt);
 const moveHs=pl.dead?0:hs,wR=civOn?1.7:ST.run,rR=civOn?4.2:ST.sprint,s=moveHs<=wR?moveHs/wR:1+clamp((moveHs-wR)/(rR-wR),0,1),sup=civOn?0:clamp((moveHs-ST.run-2)/(ST.sprint-ST.run),0,1);
 if(pl.grounded)HA.ph+=Math.min(30,moveHs/(civOn?0.85+0.35*clamp(s-1,0,1):1.2+0.6*clamp(s-1,0,1)+1.5*sup)/Math.max(1,SIZE*0.45)*Math.PI)*dt;
 let p=pLoco(Math.min(s,2),sup,time);p=mixP(p,pAir(pl.vel.y),HA.aw);p=mixP(p,mixP(mixP(pHover(time),pCruise(),HA.cruise),pBoost(),HA.bw),HA.fw);
 HA.shootW+=((time-pl.shootT<0.22?1:0)-HA.shootW)*damp(20,dt);HA.punchW+=((time-pl.punchT<0.3?1:0)-HA.punchW)*damp(25,dt);HA.shockW+=((time-pl.shockT<0.4?1:0)-HA.shockW)*damp(18,dt);
 const aimA=-1.57+clamp(pitch,-1,1)*0.8*(1-HA.fw);
 p.aR=lerp(p.aR,aimA,HA.shootW);p.eR=lerp(p.eR,-0.05,HA.shootW);p.zR=lerp(p.zR,0.05,HA.shootW);
 HA.landT=(HA.landT==null?9:HA.landT)+dt;if(HA.landT<0.3&&pl.grounded){const k=(1-HA.landT/0.3)*(HA.landK||0);p.hy-=0.2*k;p.tL-=0.6*k;p.tR-=0.6*k;p.kL+=1.1*k;p.kR+=1.1*k;p.lean+=0.25*k;}
 const cb=pl.combo||0;if(cb===1){p.aL=lerp(p.aL,-1.65,HA.punchW);p.eL=lerp(p.eL,0,HA.punchW);p.aR=lerp(p.aR,-0.9,HA.punchW);p.eR=lerp(p.eR,-1.8,HA.punchW);p.lean+=0.3*HA.punchW*(1-HA.fw);HA.punchW=HA.punchW*0.999;}
 else if(cb===2){p.aR=lerp(p.aR,-2.9,HA.punchW);p.eR=lerp(p.eR,-0.6,HA.punchW);p.aL=lerp(p.aL,0.4,HA.punchW);p.lean-=0.25*HA.punchW*(1-HA.fw);p.hy-=0.12*HA.punchW;p.kL+=0.6*HA.punchW;p.tL-=0.4*HA.punchW;}
 if(cb===0){p.aR=lerp(p.aR,-1.65,HA.punchW);p.eR=lerp(p.eR,0,HA.punchW);p.aL=lerp(p.aL,-0.9,HA.punchW);p.eL=lerp(p.eL,-1.8,HA.punchW);p.lean+=0.3*HA.punchW*(1-HA.fw);}
 p.zL=lerp(p.zL,1.5,HA.shockW);p.zR=lerp(p.zR,1.5,HA.shockW);p.aL=lerp(p.aL,-0.2,HA.shockW);p.aR=lerp(p.aR,-0.2,HA.shockW);p.eL=lerp(p.eL,-0.2,HA.shockW);p.eR=lerp(p.eR,-0.2,HA.shockW);
 if(pl.laser&&HERO.rmb==='eyes')p.hd=lerp(p.hd,clamp(pitch*0.7,-0.6,0.6),1-HA.fw);
 if(HELD&&!civOn){p.aL=p.aR=-2.9;p.eL=p.eR=-0.35;p.zL=p.zR=0.12;}
 if(mouseR&&['hands','ice','fire','tk','chain'].includes(HERO.rmb)&&!civOn&&state==='play'){const aa=-1.5+clamp(pitch,-1,1)*0.8*(1-HA.fw);p.aL=aa;p.aR=aa;p.eL=p.eR=-0.05;p.zL=p.zR=0.05;}
 if(civOn){const id=1-clamp(s,0,1);p.lean+=0.06*id;p.zL=lerp(p.zL,0.08,id);p.zR=lerp(p.zR,0.08,id);p.hd+=0.03*id;}
 {const stance=(1-clamp(s,0,1))*(1-HA.aw)*(1-HA.fw)*(civOn?0.25:1);LL.th.rotation.z=0.085*stance;LR.th.rotation.z=-0.085*stance;p.lean-=0.04*stance;p.hd-=0.05*stance;p.zL+=0.08*stance;p.zR+=0.08*stance;}
 {const active=time-pl.punchT<1.2||time-pl.shootT<1.2||time-pl.shockT<1.2||pl.laser||mouseL||mouseR||GRABBED;
  const canRest=HERO_ID==='shrink'&&pl.grounded&&!pl.flying&&!pl.dead&&!civOn&&SIZE<1.5&&hs<0.3&&Math.abs(pl.vel.y)<0.5&&!active&&state==='play';
  if(canRest)HA.restT+=dt;else HA.restT=0;
  if(HA.restMode&&(hs>0.6||pl.flying||civOn||SIZE>1.5))HA.restMode=0;
  const wantSit=HA.restMode===1||(HA.restMode===0&&HA.restT>3.5&&HA.restT<=8)?1:0,wantLie=HA.restMode===2||(HA.restMode===0&&HA.restT>8)?1:0;
  HA.sitW+=((wantSit&&!wantLie?1:0)-HA.sitW)*damp(3,dt);HA.lieW+=(wantLie-HA.lieW)*damp(2,dt);
  if(HA.sitW>0.01){const w=HA.sitW;p.hy=lerp(p.hy,0.42,w);p.tL=lerp(p.tL,-1.5,w);p.tR=lerp(p.tR,-1.5,w);p.kL=lerp(p.kL,1.7,w);p.kR=lerp(p.kR,1.7,w);p.lean=lerp(p.lean,-0.18,w);p.hd=lerp(p.hd,0.12+Math.sin(time*0.7)*0.05,w);p.aL=lerp(p.aL,-0.35,w);p.aR=lerp(p.aR,-0.35,w);p.eL=lerp(p.eL,-0.5,w);p.eR=lerp(p.eR,-0.5,w);p.zL=lerp(p.zL,0.25,w);p.zR=lerp(p.zR,0.25,w);}}
  hips.position.y=p.hy;spine.rotation.x=p.lean;head.rotation.x=p.hd;LL.th.rotation.x=p.tL;LR.th.rotation.x=p.tR;LL.kn.rotation.x=p.kL;LR.kn.rotation.x=p.kR;AL.sh.rotation.x=p.aL;AR.sh.rotation.x=p.aR;AL.el.rotation.x=p.eL;AR.el.rotation.x=p.eR;AL.sh.rotation.z=p.zL;AR.sh.rotation.z=-p.zR;
 const ct=pl.flying?0.1+0.3*(1-HA.cruise):clamp(0.1+hs*0.07+(inAir&&pl.vel.y<0?0.6:0),0.08,1.35);HA.capeA+=(ct-HA.capeA)*damp(6,dt);capeP.rotation.x=HA.capeA;
 updCape(0.015+0.045*clamp(sp/20,0,1)+0.06*HA.bw,time);
 if(!civOn&&!pl.dead&&dt>0&&(!pl.flying&&hs>80)){const ec=HM.energy.emissive,k=pl.flying?clamp(sp/190,0,1):clamp(hs/28,0,1);for(const o of pl.flying?[AL.fist,AR.fist]:[LL.kn,LR.kn]){const w=o.getWorldPosition(_v3);if(!pl.flying)w.y=pl.pos.y+0.08;emit(glowPS,w.x,w.y,w.z,rand(-0.3,0.3),rand(-0.3,0.3),rand(-0.3,0.3),0.28+0.2*k,0.55*k+0.2,0.05,Math.min(1,ec.r*1.6),Math.min(1,ec.g*1.6),Math.min(1,ec.b*1.6),0.9,0,0);}}
 if(!civOn&&!pl.dead&&dt>0){const ec=HM.energy.emissive;
  if(HERO_ID==='raven'&&pl.flying){for(const K of[LL.kn,LR.kn]){const w=K.getWorldPosition(_v3);emit(glowPS,w.x,w.y-0.35*HERO.scale,w.z,-pl.vel.x*0.15+rand(-0.4,0.4),-2-pl.vel.y*0.15,-pl.vel.z*0.15+rand(-0.4,0.4),0.18,0.42,0.06,Math.min(1,ec.r*1.4),Math.min(1,ec.g*1.4),Math.min(1,ec.b*1.4),1,0,0);}}
  if(HERO_ID==='wind'&&!pl.flying&&hs>40){for(let k=0;k<2;k++)emit(glowPS,pl.pos.x+rand(-0.4,0.4),pl.pos.y+rand(0.3,1.6),pl.pos.z+rand(-0.4,0.4),-pl.vel.x*0.05,0,-pl.vel.z*0.05,0.35,0.35,0.05,0.75,0.92,1,0.7,0,0);}}
 if(pl.dashT>0&&!civOn){const w=AR.fist.getWorldPosition(_v3),ec=new THREE.Color(energyHex());for(let k=0;k<3;k++)emit(glowPS,w.x,w.y,w.z,rand(-0.5,0.5),rand(-0.5,0.5),rand(-0.5,0.5),0.22,0.9,0.1,ec.r,ec.g,ec.b,1,0,0);}
 hero.position.copy(pl.pos);hero.rotation.y=pl.facing;
 if(dt>0){const yr=((pl.facing-(HA.pf||0)+Math.PI*3)%(Math.PI*2)-Math.PI)/dt;HA.pf=pl.facing;const gB=pl.grounded&&!civOn?clamp(-yr*0.045*clamp(hs/20,0,1),-0.22,0.22):0,fB=pl.flying?clamp(-yr*0.16*clamp(sp/40,0,1),-0.95,0.95):0;HA.gb=lerp(HA.gb||0,gB,damp(8,dt));HA.fb=lerp(HA.fb||0,fB,damp(5,dt));}
 tiltG.rotation.y=(HA.fb||0)*HA.cruise;tiltG.rotation.z=(HA.gb||0)*(1-HA.fw);
 tiltG.rotation.x=pl.dead?lerp(tiltG.rotation.x,-1.45,damp(4,dt)):lerp(pl.tilt,-1.3,HA.lieW);tiltG.position.y=pl.dead?lerp(tiltG.position.y,0.3,damp(4,dt)):lerp(1,0.35,HA.lieW);}

/* ---------- HUD ---------- */
const hud={hp:$('hpBar').firstElementChild,en:$('enBar').firstElementChild,xp:$('xpBar').firstElementChild,hpT:$('hpT'),enT:$('enT'),lvl:$('lvl'),obj:$('obj'),objName:$('objName'),objLine:$('objLine'),objDist:$('objDist'),boss:$('boss'),bossFill:$('bossFill'),spd:$('speedV').firstChild,speedM:$('speedM'),destroyed:$('destroyed'),vig:$('vig'),slots:[...document.querySelectorAll('.slot[data-i]')]};
const HC={};function sT(el,k,v){if(HC[k]!==v){HC[k]=v;el.textContent=v;}}
function sW(el,k,v){v=Math.round(v*1000)/10;if(HC[k]!==v){HC[k]=v;el.style.width=v+'%';}}
function updateHUD(dt){
 sW(hud.hp,'hp',pl.hp/ST.maxHp);sW(hud.en,'en',pl.en/ST.maxEn);sW(hud.xp,'xp',prog.xp/xpNeed(prog.level));sT(hud.hpT,'hpT',String(Math.ceil(pl.hp)));sT(hud.enT,'enT',String(Math.floor(pl.en)));sT(hud.lvl,'lvl',String(prog.level));sT($('money'),'money','₺ '+Math.floor(prog.money).toLocaleString('tr-TR'));
 const sp=pl.vel.length();sT(hud.spd,'spd',String(Math.round(sp*3.6)));sT(hud.speedM,'mode',pl.dead?'Yerde':realAlt>1000?(realAlt>100000?'Uzay  ·  ':'İrtifa  ·  ')+Math.round(realAlt/1000).toLocaleString('tr-TR')+' km':civOn?'Sivil kılık':pl.flying?(sp>=340?'Mach '+(sp/343).toFixed(1):pl.boosting?'Hızlı uçuş':'Uçuş'):(sp>=340?'Mach '+(sp/343).toFixed(1)+' koşu':Math.hypot(pl.vel.x,pl.vel.z)>ST.run+2?'Süper hız':'Yürüyüş'));sT(hud.destroyed,'des','Yıkılan bina: '+prog.destroyed);
 const cds=[pl.cd.shoot/0.2,pl.cd.punch/0.75,0,pl.cd.shock/5],locks=civOn?[true,true,true,true]:[false,false,false,prog.level<2];
 if(IS_TOUCH)document.querySelectorAll('#touch .tb[data-cd]').forEach(b=>{const i=+b.dataset.cd;b.style.setProperty('--cd',Math.round(clamp(cds[i],0,1)*100)+'%');b.classList.toggle('locked',locks[i]);});
 hud.slots.forEach((s,i)=>{const c=Math.round(clamp(cds[i],0,1)*100);if(HC['c'+i]!==c){HC['c'+i]=c;s.lastElementChild.style.height=c+'%';}s.classList.toggle('locked',locks[i]);s.classList.toggle('active',i===2&&pl.laser);});
 if(ev){hud.obj.classList.remove('hidden');sT(hud.objName,'on',ev.name);let line;if(ev.type==='race')line='Halka '+ev.ri+' / '+ev.total+(ev.timerOn?'  ·  '+Math.ceil(ev.timer)+' sn':'  ·  İlk halkaya uç');else if(ev.type==='boss')line='Dev mekaniği yok et';else line=ev.kills+' / '+ev.total+' düşman'+(ev.timerOn?'  ·  '+Math.ceil(ev.timer)+' sn':'');sT(hud.objLine,'ol',line);const t=evTarget();sT(hud.objDist,'od',Math.round(Math.hypot(t.x-pl.pos.x,t.z-pl.pos.z))+' m uzakta');}else hud.obj.classList.add('hidden');
 const boss=enemies.find(e=>e.type==='boss'&&!e.dead);if(boss){hud.boss.classList.remove('hidden');sW(hud.bossFill,'boss',Math.max(0,boss.hp)/boss.maxHp);}else hud.boss.classList.add('hidden');
 dmgFlash=Math.max(0,dmgFlash-dt*1.5);const low=pl.hp<ST.maxHp*0.3&&!pl.dead?0.35+0.15*Math.sin(time*6):0;hud.vig.style.opacity=Math.max(dmgFlash,low).toFixed(2);
 drawLines();drawMinimap();}
const lc=$('lines'),lctx=lc.getContext('2d');let linesOn=false;
function drawLines(){const sp=pl.vel.length();const f=state!=='play'||pl.dead?0:pl.flying?clamp(Math.log2(Math.max(1,sp/20))/4.1,0,1):clamp(Math.log2(Math.max(1,Math.hypot(pl.vel.x,pl.vel.z)/25))/2.2,0,1)*0.85;
 if(f<=0.01){if(linesOn){lctx.clearRect(0,0,lc.width,lc.height);linesOn=false;}return;}linesOn=true;const w=lc.width,h=lc.height,cx=w/2,cy=h/2,R0=Math.min(w,h)*0.32;lctx.clearRect(0,0,w,h);lctx.strokeStyle='rgba(255,255,255,'+(0.35*f).toFixed(3)+')';lctx.lineWidth=1.5;lctx.beginPath();
 for(let i=0;i<Math.round(60*f);i++){const a=Math.random()*6.283,r=R0+Math.random()*Math.max(w,h)*0.35,l=40+Math.random()*160*f;lctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);lctx.lineTo(cx+Math.cos(a)*(r+l),cy+Math.sin(a)*(r+l));}lctx.stroke();}
const mm=$('minimap'),mctx=mm.getContext('2d');
function drawMinimap(){const S=mm.width,c=S/2,sc=c/220;mctx.clearRect(0,0,S,S);mctx.save();mctx.beginPath();mctx.arc(c,c,c-1,0,Math.PI*2);mctx.fillStyle='rgba(18,26,46,.78)';mctx.fill();mctx.clip();mctx.translate(c,c);const al=Math.atan2(Math.cos(yaw),Math.sin(yaw));mctx.rotate(-Math.PI/2-al);
 mctx.fillStyle='rgba(169,182,204,.55)';if(!ARENA)for(const b of outer){if(!b.alive)continue;const x=(b.x-pl.pos.x)*sc,z=(b.z-pl.pos.z)*sc;if(Math.abs(x)>c*1.5||Math.abs(z)>c*1.5)continue;mctx.fillRect(x-b.w*sc/2,z-b.d*sc/2,b.w*sc,b.d*sc);}if(!ARENA)for(const b of buildings){if(!b.alive)continue;const x=(b.x-pl.pos.x)*sc,z=(b.z-pl.pos.z)*sc;if(Math.abs(x)>c*1.5||Math.abs(z)>c*1.5)continue;mctx.fillRect(x-b.w*sc/2,z-b.d*sc/2,b.w*sc,b.d*sc);}
 for(const e of enemies){if(e.dead||e.type==='villain')continue;mctx.fillStyle=e.type==='boss'?'#ff3030':'#ff6a50';mctx.beginPath();mctx.arc((e.pos.x-pl.pos.x)*sc,(e.pos.z-pl.pos.z)*sc,e.type==='boss'?5:2.6,0,Math.PI*2);mctx.fill();}
 for(const VS of VILS){const V=VS.e;if(V&&!V.dead){let x=(V.pos.x-pl.pos.x)*sc,z=(V.pos.z-pl.pos.z)*sc;const L=Math.hypot(x,z),m=c-13,out=L>m,dist=Math.round(L/sc),pu=0.5+0.5*Math.sin(time*6);if(out){x*=m/L;z*=m/L;}
  if(!out){const rr=Math.max(6,V.r*sc);mctx.fillStyle='rgba(255,59,48,'+(0.16+0.16*pu).toFixed(3)+')';mctx.beginPath();mctx.arc(x,z,rr+3*pu,0,Math.PI*2);mctx.fill();}
  mctx.save();mctx.translate(x,z);if(out){mctx.save();mctx.rotate(Math.atan2(z,x));mctx.fillStyle='#ff3b30';mctx.beginPath();mctx.moveTo(14,0);mctx.lineTo(5,-6);mctx.lineTo(5,6);mctx.closePath();mctx.fill();mctx.restore();}
  mctx.fillStyle='#ff3b30';mctx.strokeStyle='#ffffff';mctx.lineWidth=2;mctx.beginPath();mctx.arc(0,0,6.5+pu*1.2,0,Math.PI*2);mctx.fill();mctx.stroke();
  mctx.rotate(Math.PI/2+al);mctx.fillStyle='#ffffff';mctx.textAlign='center';mctx.textBaseline='middle';mctx.font='800 10px Saira, Arial, sans-serif';mctx.fillText('!',0,0.5);
  if(out){const ix=-x/m,iz=-z/m,ca=Math.cos(Math.PI/2+al),sa=Math.sin(Math.PI/2+al);const tx=ix*ca+iz*sa,ty=-ix*sa+iz*ca;mctx.font='700 10px Saira, Arial, sans-serif';mctx.fillText(dist+' m',tx*20,ty*20);}
  mctx.restore();}}
 if(ev){const t=evTarget();let x=(t.x-pl.pos.x)*sc,z=(t.z-pl.pos.z)*sc;const L=Math.hypot(x,z),m=c-10;if(L>m){x*=m/L;z*=m/L;}mctx.save();mctx.translate(x,z);mctx.rotate(Math.PI/2+al);mctx.fillStyle='#e8b923';mctx.beginPath();mctx.moveTo(0,-7);mctx.lineTo(6,0);mctx.lineTo(0,7);mctx.lineTo(-6,0);mctx.closePath();mctx.fill();mctx.restore();}
 mctx.restore();mctx.fillStyle='#eef3fa';mctx.beginPath();mctx.moveTo(c,c-8);mctx.lineTo(c+5.5,c+6);mctx.lineTo(c,c+3);mctx.lineTo(c-5.5,c+6);mctx.closePath();mctx.fill();mctx.strokeStyle='rgba(238,243,250,.35)';mctx.lineWidth=1.5;mctx.beginPath();mctx.arc(c,c,c-1,0,Math.PI*2);mctx.stroke();}

/* ---------- menus & input ---------- */
const UPG=[{k:'hp',name:'Dayanıklılık',desc:'+30 maksimum can'},{k:'en',name:'Enerji çekirdeği',desc:'+25 enerji ve daha hızlı dolum'},{k:'fly',name:'Uçuş motoru',desc:'Daha çevik uçuş: daha hızlı ivmelenme ve daha yıkıcı çarpışmalar'},{k:'run',name:'Süper bacaklar',desc:'Daha çevik koşu ve daha yüksek zıplama'},{k:'dmg',name:'Kudret',desc:'Tüm saldırılar %25 daha fazla hasar verir'}];
let upFrom='play',locked=false,lockOK=false,fallback=false;
function lock(){if(fallback)return;try{const r=view.requestPointerLock();if(r&&r.catch)r.catch(()=>{if(!lockOK)fallback=true;});}catch(e){fallback=true;}}
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===view;if(locked)lockOK=true;else if(state==='play')pause();});
document.addEventListener('pointerlockerror',()=>{if(!lockOK)fallback=true;});
function hideAll(){['menu','pause','upgrades','costume','shop','heroes','maps','net','settings'].forEach(id=>$(id).classList.add('hidden'));}
function clearInput(){if(typeof TOUCH!=='undefined'){TOUCH.mx=TOUCH.my=0;TOUCH.sprint=false;TOUCH.stick=TOUCH.look=null;const sb=$('stickBase');if(sb)sb.style.display='none';document.querySelectorAll('#touch .tb.on').forEach(b=>b.classList.remove('on'));}for(const k in keys)keys[k]=false;for(const k in pressed)delete pressed[k];mouseL=mouseR=false;lookX=lookY=0;}
function pause(){if(state!=='play')return;if(PHOTO)togglePhoto();renderStats();state='pause';clearInput();$('touch').classList.add('hidden');$('pause').classList.remove('hidden');}
function resume(){hideAll();clearInput();state='play';$('hud').classList.remove('hidden');if(IS_TOUCH)$('touch').classList.remove('hidden');lock();}
function startGame(){initAudio();if(AC&&AC.state==='suspended')AC.resume();ST=stats();pl.hp=ST.maxHp;pl.en=ST.maxEn;pl.pos.copy(SPAWN);pl.vel.set(0,0,0);nextEventAt=time+12;resume();}
function renderUpgrades(){$('upPoints').textContent='Geliştirme puanı: '+prog.points;const L=$('upList');L.innerHTML='';
 for(const u of UPG){const lv=up[u.k],row=document.createElement('div');row.className='up';const info=document.createElement('div');const h=document.createElement('h3');h.textContent=u.name;const p=document.createElement('p');p.textContent=u.desc;const pp=document.createElement('div');pp.className='pips';for(let i=0;i<5;i++){const s=document.createElement('i');if(i<lv)s.className='on';pp.appendChild(s);}info.append(h,p,pp);
  const btn=document.createElement('button');btn.className='btn';btn.textContent=lv>=5?'En üst seviye':'Geliştir';
  btn.onclick=()=>{if(up[u.k]>=5){$('upMsg').textContent='Bu yetenek zaten en üst seviyede.';return;}if(prog.points<=0){$('upMsg').textContent='Geliştirme puanın yok. Seviye atladıkça puan kazanırsın.';return;}up[u.k]++;prog.points--;const oldHp=ST.maxHp,oldEn=ST.maxEn;ST=stats();pl.hp+=ST.maxHp-oldHp;pl.en+=ST.maxEn-oldEn;saveNow();renderUpgrades();$('upMsg').textContent=u.name+' geliştirildi.';};
  row.append(info,btn);L.appendChild(row);}}
function openUpgrades(from){$('touch').classList.add('hidden');upFrom=from;state='upgrade';clearInput();if(document.pointerLockElement)document.exitPointerLock();hideAll();$('upMsg').textContent='';renderUpgrades();$('upgrades').classList.remove('hidden');}
function closeUpgrades(){$('upgrades').classList.add('hidden');if(upFrom==='menu'){state='menu';$('menu').classList.remove('hidden');}else if(upFrom==='pause'){state='pause';$('pause').classList.remove('hidden');}else resume();}
function toggleFP(){FP=!FP;toast(FP?'Birinci şahıs':'Üçüncü şahıs',FP?'V ile geri dön':'');}
let cosFrom='menu',shopFrom='menu';
function fmtM(n){return '₺ '+Math.floor(n).toLocaleString('tr-TR');}
function addMoney(n,label){prog.money+=n;const m=$('money');m.classList.remove('pop');void m.offsetWidth;m.classList.add('pop');if(label)toast('+'+fmtM(n),label);saveDirty=true;}
function applyLaserColor(){const c=LASER_COLS[laserColor]||LASER_COLS.kirmizi;beams.forEach(b=>b.material.color.copy(lin(c)));}
const SHOP=[
 {id:'point',name:'Geliştirme puanı',desc:'Tab menüsünde bir yeteneğini geliştir.',price:1500,buy:()=>{prog.points++;return 'Bir geliştirme puanı aldın. Tab ile harca.';}},
 {id:'heal',name:'Tam can',desc:'Canını anında doldurur.',price:250,buy:()=>{pl.hp=ST.maxHp;return 'Canın doldu.';}},
 {id:'energy',name:'Tam enerji',desc:'Enerjini anında doldurur.',price:150,buy:()=>{pl.en=ST.maxEn;return 'Enerjin doldu.';}},
 {id:'cos_altin',name:'Kostüm: Altın Zırh',desc:'Parlak altın zırhlı özel kostüm.',price:3000,once:true,buy:()=>{renderPresets();return 'Altın Zırh kostüm ekranına (K) eklendi.';}},
 {id:'cos_simsek',name:'Kostüm: Kara Şimşek',desc:'Siyah ve sarı, pelerinsiz hız kostümü.',price:3000,once:true,buy:()=>{renderPresets();return 'Kara Şimşek kostüm ekranına (K) eklendi.';}},
 {id:'cos_yildiz',name:'Kostüm: Kızıl Yıldız',desc:'Kırmızı, gümüş ve lacivert klasik kostüm.',price:3000,once:true,buy:()=>{renderPresets();return 'Kızıl Yıldız kostüm ekranına (K) eklendi.';}},
 {id:'laser_mavi',name:'Lazer rengi: Mavi',desc:'Isı lazerin mavi yanar.',price:1000,laser:'mavi'},
 {id:'laser_yesil',name:'Lazer rengi: Yeşil',desc:'Isı lazerin yeşil yanar.',price:1000,laser:'yesil'},
 {id:'laser_mor',name:'Lazer rengi: Mor',desc:'Isı lazerin mor yanar.',price:1000,laser:'mor'},
 {id:'laser_kirmizi',name:'Lazer rengi: Kırmızı',desc:'Klasik kırmızı lazer.',price:0,laser:'kirmizi'}];
function renderShop(){$('shopBal').textContent=fmtM(prog.money);const L=$('shopList');L.innerHTML='';
 for(const it of SHOP){const row=document.createElement('div');row.className='up';const info=document.createElement('div');const h=document.createElement('h3');h.textContent=it.name;const d=document.createElement('p');d.textContent=it.desc;info.append(h,d);
  const has=owned.includes(it.id)||it.price===0,right=document.createElement('div');right.style.cssText='display:flex;gap:12px;align-items:center';
  const btn=document.createElement('button');btn.className='btn';btn.type='button';
  if(it.laser&&has){const on=laserColor===it.laser;btn.textContent=on?'Kullanılıyor':'Kullan';if(on)btn.className='btn alt';btn.onclick=()=>{laserColor=it.laser;applyLaserColor();saveNow();renderShop();$('shopMsg').textContent=it.name+' seçildi.';};right.append(btn);}
  else if(it.once&&has){const o=document.createElement('span');o.className='own';o.textContent='Sahipsin';right.append(o);}
  else{const pr=document.createElement('span');pr.className='price';pr.textContent=fmtM(it.price);btn.textContent='Satın al';btn.onclick=()=>{if(prog.money<it.price){$('shopMsg').textContent='Yeterli paran yok. Düşman yenerek ve görev tamamlayarak para kazan.';return;}prog.money-=it.price;let msg='';if(it.once||it.laser)owned.push(it.id);if(it.laser){laserColor=it.laser;applyLaserColor();msg=it.name+' alındı ve seçildi.';}else msg=it.buy();saveNow();renderShop();$('shopMsg').textContent=msg;};right.append(pr,btn);}
  row.append(info,right);L.appendChild(row);}}
function openShop(from){$('touch').classList.add('hidden');shopFrom=from;state='shop';clearInput();if(document.pointerLockElement)document.exitPointerLock();hideAll();$('shopMsg').textContent='';renderShop();$('shop').classList.remove('hidden');}
function closeShop(){$('shop').classList.add('hidden');saveNow();if(shopFrom==='pause'){state='pause';$('pause').classList.remove('hidden');}else if(shopFrom==='play')resume();else{state='menu';$('menu').classList.remove('hidden');}}
if(SAVED_VOL)for(const k of['master','music','sfx'])if(typeof SAVED_VOL[k]==='number')VOL[k]=clamp(SAVED_VOL[k],0,1);
for(const [id,k] of[['vMaster','master'],['vMusic','music'],['vSfx','sfx']]){const el=$(id);el.value=VOL[k];el.addEventListener('input',()=>{VOL[k]=parseFloat(el.value);applyVolumes();saveDirty=true;});}
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('button,.pre,.tod'))sfx('click',0.8);});
/* ---------- hero extras, abilities and library ---------- */
const heroExtras={wind:[],titan:[],raven:[],ice:[],shadow:[],shrink:[],void:[],wing:[]};
{const visorM=new THREE.MeshPhysicalMaterial({color:lin(0x0e1620),roughness:0.08,metalness:0.6,clearcoat:1,clearcoatRoughness:0.05});
 const g=hadd(new THREE.SphereGeometry(0.121,32,8,0,Math.PI*2,1.22,0.34),visorM,head,0,0.012,0.004,1.06,1.12,1.1);heroExtras.wind.push(g);
 const strap=hadd(new THREE.TorusGeometry(0.118,0.008,6,32),visorM,head,0,0.018,0,1.04,1,1.08);strap.rotation.x=Math.PI/2;heroExtras.wind.push(strap);
 const rockM=M(0x5e554c,0.95,{flatShading:true});for(const [par,x,y,z,s] of[[spine,0.18,0.55,-0.02,0.12],[spine,-0.18,0.55,-0.02,0.12],[spine,0,0.42,-0.12,0.13],[spine,0.1,0.25,-0.12,0.09],[spine,-0.1,0.25,-0.12,0.09],[AL.sh,0,0.02,0,0.1],[AR.sh,0,0.02,0,0.1],[AL.el,0,-0.12,-0.02,0.07],[AR.el,0,-0.12,-0.02,0.07],[LL.kn,0,-0.1,0.04,0.075],[LR.kn,0,-0.1,0.04,0.075]]){const r=hadd(lumpy(1,0.22),rockM,par,x,y,z,s,s*0.8,s);r.rotation.set(rand(0,3),rand(0,3),0);heroExtras.titan.push(r);}
 const helmM=new THREE.MeshPhysicalMaterial({color:lin(0x3a3f47),roughness:0.25,metalness:0.85,clearcoat:0.8,clearcoatRoughness:0.15});heroExtras.raven.helm=helmM;
 heroExtras.raven.push(hadd(new THREE.SphereGeometry(0.132,32,20),helmM,head,0,0.012,0,1.04,1.14,1.12));
 heroExtras.raven.push(hadd(new THREE.SphereGeometry(0.134,32,6,Math.PI*0.25,Math.PI*0.5,1.3,0.22),HM.energy,head,0,0.012,0,1.04,1.14,1.12));
 for(const K of[LL.kn,LR.kn])heroExtras.raven.push(hadd(new THREE.CylinderGeometry(0.05,0.06,0.06,16),HM.energy,K,0,-0.47,-0.02));
 for(const k in heroExtras)heroExtras[k].forEach(m=>m.visible=false);}
{const iceM=new THREE.MeshPhysicalMaterial({color:lin(0xcfefff),roughness:0.08,metalness:0.1,clearcoat:1,transparent:true,opacity:0.85});
 for(const [par,x,y,z,rx,rz,s] of[[AL.sh,0.02,0.08,0,0,-0.5,1],[AL.sh,0.05,0.05,0.03,0.3,-0.9,0.8],[AR.sh,-0.02,0.08,0,0,0.5,1],[AR.sh,-0.05,0.05,0.03,0.3,0.9,0.8],[AL.el,0.05,-0.12,0,0,-1.2,0.7],[AR.el,-0.05,-0.12,0,0,1.2,0.7],[spine,0.08,0.6,-0.08,-0.5,-0.3,0.8],[spine,-0.08,0.6,-0.08,-0.5,0.3,0.8]]){const c=hadd(new THREE.ConeGeometry(0.03,0.16,5).translate(0,0.08,0),iceM,par,x,y,z,s,s,s);c.rotation.set(rx,0,rz);heroExtras.ice.push(c);}
 const hood=hadd(new THREE.SphereGeometry(0.138,28,18,0,Math.PI*2,0,1.95),M(0x1b1c22,0.92),head,0,0.02,-0.012,1.06,1.16,1.12);hood.rotation.x=-0.35;heroExtras.shadow.push(hood);
 const scarf=hadd(new THREE.TorusGeometry(0.075,0.03,10,24).rotateX(Math.PI/2),M(0x2a1f3d,0.9),spine,0,0.66,0.0,1,1,0.9);heroExtras.shadow.push(scarf);
 for(const s of[1,-1]){const d=hadd(new THREE.CylinderGeometry(0.034,0.034,0.016,24).rotateX(Math.PI/2),HM.energy,spine,s*0.05,0.06,0.15);heroExtras.shrink.push(d);}
 /* Zerre: refined feminine figure, flowing hair, long gloves, knee-high boots, size emblem */
 {const SG=()=>new THREE.SphereGeometry(1,24,18);const X=heroExtras.shrink;const add=(g,m,p,x,y,z,sx,sy,sz,rx,ry,rz)=>{const o=hadd(g,m,p,x,y,z,sx,sy,sz);o.rotation.set(rx||0,ry||0,rz||0);X.push(o);return o;};
  for(const s of[1,-1]){add(SG(),HM.suit,spine,s*0.068,0.408,0.108,0.072,0.068,0.064,0.12,s*0.28,0);add(SG(),HM.suit,spine,s*0.06,0.37,0.1,0.06,0.04,0.055,0,s*0.2,0);}
  add(new THREE.TorusGeometry(0.026,0.005,8,32),HM.energy,spine,0,0.5,0.13);add(new THREE.TorusGeometry(0.026,0.005,8,32),HM.energy,spine,0,0.5,0.13,1,1,1,0,Math.PI/2.6,0);add(new THREE.SphereGeometry(0.009,12,8),HM.energy,spine,0,0.5,0.13);
  add(new THREE.SphereGeometry(0.126,32,20,0,Math.PI*2,0,1.72),HM.hair,head,0,0.024,-0.02,1.06,1.13,1.13,-0.62,0,0);
  add(SG(),HM.hair,head,0,0.01,-0.075,0.118,0.12,0.09);
  add(SG(),HM.hair,head,0.035,0.098,0.085,0.08,0.022,0.04,0.25,0,-0.38);add(SG(),HM.hair,head,-0.05,0.092,0.08,0.05,0.02,0.035,0.2,0,0.3);
  add(new THREE.TorusGeometry(0.028,0.011,8,18),HM.acc,head,0,0.075,-0.122,1,1,1,0.55,0,0);
  const tail=[[0.044,0.065,-0.14],[0.042,0.0,-0.168],[0.038,-0.07,-0.185],[0.033,-0.14,-0.192],[0.028,-0.21,-0.19],[0.022,-0.27,-0.183],[0.016,-0.32,-0.172]];
  for(const [r,y,z] of tail)add(SG(),HM.hair,head,0,y,z,r,r*1.7,r*0.95);
  for(const s of[1,-1]){add(SG(),HM.hair,head,s*0.098,-0.03,0.03,0.022,0.09,0.03,0,0,s*0.1);add(SG(),HM.hair,head,s*0.092,-0.11,0.04,0.016,0.05,0.022,0,0,s*0.06);}
  const lipZ=M(0xb4545a,0.38);add(SG(),lipZ,head,0,-0.0505,0.1065,0.03,0.0095,0.013);add(SG(),lipZ,head,0,-0.0615,0.1035,0.027,0.011,0.013);
  const lashM=M(0x1a1410,0.4);for(const sx of[1,-1]){add(new THREE.TorusGeometry(0.016,0.0025,6,14,Math.PI),lashM,head,sx*0.035,0.012,0.108,1,1,1,-0.35,sx*0.1,0);add(SG(),lashM,head,sx*0.052,0.015,0.104,0.01,0.004,0.004);
   add(SG(),M(0x4a3524,0.5),head,sx*0.038,0.04,0.107,0.022,0.005,0.008);}
  add(SG(),HM.skin,head,0,-0.02,0.112,0.014,0.02,0.016);
  for(const A of[AL,AR]){add(new THREE.CylinderGeometry(0.05,0.044,0.25,18),HM.acc,A.el,0,-0.13,0);add(new THREE.TorusGeometry(0.052,0.008,8,22).rotateX(Math.PI/2),HM.energy,A.el,0,-0.012,0);}
  for(const K of[LL.kn,LR.kn]){add(new THREE.CylinderGeometry(0.068,0.057,0.38,18),HM.acc,K,0,-0.23,0.004);add(new THREE.TorusGeometry(0.069,0.01,8,24).rotateX(Math.PI/2),HM.energy,K,0,-0.035,0.004);add(SG(),HM.acc,K,0,-0.02,0.05,0.06,0.06,0.04);}
  add(new THREE.CylinderGeometry(0.06,0.06,0.07,20,1,true),HM.suit,spine,0,0.62,0.0,1,1,0.9);}
 for(const k of['ice','shadow','shrink'])heroExtras[k].forEach(m=>m.visible=false);}
/* ice spikes */
const ICE_N=64,iceSp=[];const iceI=new THREE.InstancedMesh(new THREE.ConeGeometry(0.7,1,6).translate(0,0.5,0),new THREE.MeshPhysicalMaterial({color:lin(0xbfe8ff),roughness:0.06,metalness:0.1,clearcoat:1,transparent:true,opacity:0.88}),ICE_N);iceI.frustumCulled=false;iceI.castShadow=true;for(let i=0;i<ICE_N;i++){iceI.setMatrixAt(i,ZM);iceSp.push({t:9});}scene.add(iceI);let iceIdx=0;
function spawnIce(x,z,h){const s=iceSp[iceIdx];s.i=iceIdx;iceIdx=(iceIdx+1)%ICE_N;s.x=x;s.z=z;s.h=h;s.t=0;s.ry=rand(0,6);s.tx=rand(-0.25,0.25);s.tz=rand(-0.25,0.25);s.y=inRiver(x,z)?WATER_Y:0;}
function updateIce(dt){let ch=false;for(const s of iceSp){if(s.t>5)continue;s.t+=dt;ch=true;const k=s.t<0.18?s.t/0.18:s.t>4?Math.max(0,1-(s.t-4)):1;dm.position.set(s.x,s.y-0.2,s.z);dm.rotation.set(s.tx,s.ry,s.tz);dm.scale.set(Math.max(0.001,k),Math.max(0.001,s.h*k),Math.max(0.001,k));dm.updateMatrix();iceI.setMatrixAt(s.i,s.t>5?ZM:dm.matrix);}if(ch)iceI.instanceMatrix.needsUpdate=true;dm.rotation.set(0,0,0);
 SIZE=lerp(SIZE,SIZE_T,damp(SIZE_T>SIZE?1.4:5,dt));{const cf=1500*Math.max(1,Math.min(26,SIZE/160));if(Math.abs(camera.far-cf)>5){camera.far=cf;camera.updateProjectionMatrix();}}
 {const e=Math.min(420,60*Math.max(1,SIZE/7)),sc=sun.shadow.camera;if(Math.abs(sc.right-e)>2){sc.left=-e;sc.right=e;sc.top=e;sc.bottom=-e;sc.far=Math.max(sc.far,e*3);sc.updateProjectionMatrix();}}}
function iceHit(dt){const tgt=aim.point,b=aim.b;moltenT-=dt;if(moltenT<=0){moltenT=0.02;addMolten(tgt,b?boxNormal(tgt,b.col):UP,b,1);}
 if(Math.random()<0.8)emit(glowPS,tgt.x,tgt.y,tgt.z,rand(-2,2),rand(1,4),rand(-2,2),rand(0.4,0.8),0.3,0.1,0.75,0.92,1,1,0.5,-6);
 if(aim.e){damageEnemy(aim.e,45*ST.dmg*dt,null);aim.e.stun=Math.max(aim.e.stun||0,2.2);}
 if(aim.ped)aim.ped.wait=Math.max(aim.ped.wait,4);if(aim.car&&aim.car.moving)aim.car.speed=Math.max(0,aim.car.speed-30*dt);}
function tryIceBurst(){if(pl.dead||pl.cd.shock>0||pl.en<30)return;pl.cd.shock=5;pl.en-=30;pl.shockT=time;const R=16;
 for(let i=0;i<46;i++){const a=rand(0,6.283),r=rand(2.5,R);spawnIce(pl.pos.x+Math.cos(a)*r,pl.pos.z+Math.sin(a)*r,rand(1.5,5)*(1-r/R*0.5));}
 fxGroundRing(pl.pos,1,R*1.1,0.6,'#cfefff');fxFlash(pl.pos.clone().setY(pl.pos.y+1),2,10,0.25,'#cfefff');for(let i=0;i<60;i++){const a=rand(0,6.283);emit(glowPS,pl.pos.x,pl.pos.y+1,pl.pos.z,Math.cos(a)*rand(6,16),rand(0,4),Math.sin(a)*rand(6,16),rand(0.4,0.9),0.4,0.1,0.8,0.94,1,1,1.5,-4);}
 for(const e of enemies){if(e.dead)continue;if(e.pos.distanceTo(pl.pos)<R+e.r){damageEnemy(e,40*ST.dmg,null);e.stun=3.2;}}
 for(const p of peds)if(Math.hypot(p.x-pl.pos.x,p.z-pl.pos.z)<R)p.wait=Math.max(p.wait,4);addShake(0.3);sfx('shatter',1);sfx('shock',0.5);}
/* ---------- Hiçlik: black hole (Q) and the erasure wave (G) ---------- */
{const halo=hadd(new THREE.TorusGeometry(0.24,0.011,8,64),HM.energy,head,0,0.06,-0.2);heroExtras.void=[halo];
 const halo2=hadd(new THREE.TorusGeometry(0.31,0.005,6,64),HM.energy,head,0,0.06,-0.23);heroExtras.void.push(halo2);
 for(const s of[1,-1]){const sp=hadd(new THREE.ConeGeometry(0.035,0.2,6),HM.armor,spine,s*0.2,0.66,-0.02);sp.rotation.z=-s*0.5;heroExtras.void.push(sp);}
 heroExtras.void.forEach(m=>m.visible=false);}
const holes=[],bhMat=new THREE.MeshBasicMaterial({color:0x000000});
function tryBlackHole(){if(pl.dead||pl.cd.shock>0||pl.en<40)return;pl.cd.shock=6;pl.en-=40;const p=aim.point.clone();p.y=Math.max(p.y,5);
 const core=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),bhMat);core.position.copy(p);scene.add(core);
 const ring=new THREE.Sprite(new THREE.SpriteMaterial({map:ringTex,color:0xff2a3a,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));ring.position.copy(p);scene.add(ring);
 holes.push({p,core,ring,t:0});sfx('charge',1);sfx('shock',0.6);}
function updateHoles(dt){for(let i=holes.length-1;i>=0;i--){const h=holes[i];h.t+=dt;const k=Math.min(1,h.t/0.5),R=45;
 h.core.scale.setScalar(2.5*k+Math.sin(h.t*20)*0.1);h.ring.scale.setScalar(16*k*(1+0.1*Math.sin(h.t*7)));h.ring.material.rotation+=dt*3;
 for(let n=0;n<5;n++){const a=rand(0,6.283),r=rand(6,18);emit(glowPS,h.p.x+Math.cos(a)*r,h.p.y+rand(-2,2),h.p.z+Math.sin(a)*r,-Math.cos(a)*r*1.2-Math.sin(a)*r,0,-Math.sin(a)*r*1.2+Math.cos(a)*r,0.6,0.5,0.1,1,0.2,0.25,1,0,0);}
 for(const e of enemies){if(e.dead)continue;const d=h.p.clone().sub(e.pos);const L=d.length();if(L<R&&L>0.1){d.divideScalar(L);if(e.type==='drone'){e.vel.addScaledVector(d,60*dt);e.knock=0.5;}else if(e.type!=='boss'){e.airborne=true;e.vel.lerp(d.multiplyScalar(25),damp(3,dt));}damageEnemy(e,30*dt,null);}}
 for(const c of cars){if(c.state!==0)continue;const dx=h.p.x-c.pos.x,dz=h.p.z-c.pos.z,L=Math.hypot(dx,dz);if(L<R*0.8&&L>0.1)launchCar(c,new V3(dx/L*18,14,dz/L*18));}
 for(const pd of peds){if(pd.down>0||pd.gone)continue;const dx=h.p.x-pd.x,dz=h.p.z-pd.z,L=Math.hypot(dx,dz);if(L<R*0.7&&L>0.1)knockPed(pd,new V3(dx/L,0,dz/L),12);}
 if(h.t>3.2){fxFlash(h.p,2,40,0.5,'#ff2a3a');fxDome(h.p,2,30,0.6,new THREE.Color(1,0.2,0.25));sfxAt('boom',h.p,600,1.2);addShakeAt(h.p,1);splash(h.p,30,250*ST.dmg,null);cityImpact(h.p,30,30);
  for(const b of solidsNear(h.p.x,h.p.z).slice())if(b.alive&&boxDist(h.p,b.col)<25)damageBuilding(b,1500,closestOnBox(h.p,b.col),true);scene.remove(h.core,h.ring);h.ring.material.dispose();holes.splice(i,1);}}}
let CITY_EMPTY=false,ultCd=0;const WAVE={on:false,r:0,o:new V3(),mode:0,counted:0,dome:null};
function hidePed(i){for(const k in PI_){const m=PI_[k];if(m.count===PN*2){m.setMatrixAt(i*2,ZM);m.setMatrixAt(i*2+1,ZM);}else m.setMatrixAt(i,ZM);}}
function tryErase(){if(ARENA){toast('Arazide kimse yok','Yok Oluş sadece şehirde işe yarar');return;}if(pl.dead||WAVE.on||ultCd>0)return;ultCd=5;WAVE.on=true;WAVE.r=0;WAVE.o.copy(pl.pos);WAVE.mode=CITY_EMPTY?2:1;WAVE.counted=0;
 if(!WAVE.dome){WAVE.dome=new THREE.Mesh(new THREE.SphereGeometry(1,48,24),new THREE.ShaderMaterial({uniforms:{col:{value:new THREE.Color()},op:{value:1}},vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 wp=modelMatrix*vec4(position,1.0);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}',
  fragmentShader:'uniform vec3 col;uniform float op;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.0-abs(dot(vN,vV)),2.5);gl_FragColor=vec4(col*(0.08+f*1.4)*op,1.0);}',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));WAVE.dome.frustumCulled=false;scene.add(WAVE.dome);}
 WAVE.dome.material.uniforms.col.value.set(WAVE.mode===1?0xff2a3a:0xffe6b0);WAVE.dome.visible=true;WAVE.dome.position.copy(pl.pos);
 const c=pl.pos.clone();c.y+=1.5;fxFlash(c,2,60,0.6,WAVE.mode===1?'#ff2a3a':'#ffe6b0');fxGroundRing(pl.pos,2,80,1,WAVE.mode===1?'#ff2a3a':'#ffe6b0');sfx('shock',1.2);sfx('collapse',0.8);addShake(0.8);
 toast(WAVE.mode===1?'Yok Oluş':'Diriliş',WAVE.mode===1?'Şehirdeki herkes yok oluyor':'İnsanlar geri dönüyor');}
function updateWave(dt){if(ultCd>0)ultCd-=dt;const U=crowd.U;if(!WAVE.on)return;WAVE.r+=dt*(260+WAVE.r*0.9);U.uWaveO.value.set(WAVE.o.x,WAVE.o.z);U.uWaveR.value=WAVE.r;U.uWaveM.value=WAVE.mode;
 WAVE.dome.scale.setScalar(WAVE.r);WAVE.dome.material.uniforms.op.value=clamp(1-WAVE.r/2600,0,1);
 if(WAVE.mode===1){for(const p of peds){if(p.down>0||p.gone)continue;const dx=p.x-WAVE.o.x,dz=p.z-WAVE.o.z,d=Math.hypot(dx,dz);if(d<WAVE.r){knockPed(p,new V3(dx/(d||1),0,dz/(d||1)),1.5);p.down=2.5;}}
  const n=Math.floor(CROWD_N*Math.min(1,Math.pow(WAVE.r/2300,1.6)));if(n>WAVE.counted){bumpKills(n-WAVE.counted);WAVE.counted=n;}}
 else{for(const p of peds){if(!p.gone)continue;const dx=p.x-WAVE.o.x,dz=p.z-WAVE.o.z;if(dx*dx+dz*dz<WAVE.r*WAVE.r){p.gone=false;p.down=0;p.panic=rand(4,8);}}}
 if(WAVE.r>2600){WAVE.on=false;WAVE.dome.visible=false;if(WAVE.mode===1){CITY_EMPTY=true;U.uWaveR.value=1e7;if(CROWD_N>WAVE.counted)bumpKills(CROWD_N-WAVE.counted);toast('Şehir boş','G ile insanları geri getirebilirsin');}else{CITY_EMPTY=false;U.uWaveM.value=0;for(const p of peds)p.gone=false;}}}

/* ---------- villain mode: any hero from the roster, AI-controlled, attacking the city ---------- */
const VILS=[],VIL_MAX=30;let VILLAIN_ACTING=null;
const VKIT={guardian:{fly:true,speed:55,atk:['beam']},wind:{fly:false,speed:85,atk:['melee','melee','whirl'],top:833},titan:{fly:false,speed:24,atk:['slam','melee']},raven:{fly:true,speed:50,atk:['bolts','beam']},
 ice:{fly:true,speed:40,atk:['beam'],ice:true},shadow:{fly:false,speed:45,atk:['blink','melee']},brute:{fly:false,speed:40,atk:['slam','slam','melee'],giant:60},void:{fly:true,speed:50,atk:['beam','slam']},fire:{fly:true,speed:50,atk:['beam','slam']},psychic:{fly:true,speed:45,atk:['bolts','slam']},storm:{fly:true,speed:55,atk:['strike','beam']},wing:{fly:true,speed:60,atk:['slam','melee']},blade:{fly:true,speed:50,atk:['beam','beam']},twin:{fly:true,speed:50,atk:['beam','bolts']}};
function mkRib(){const r=ribbons[0].clone();r.material=ribbons[0].material.clone();LIN_MATS.push(r.material);r.visible=false;scene.add(r);return r;}
function buildVillainModel(vid){const H=HEROES[vid],look=Object.assign({},COS_DEF,H.look||{},heroCostumes[vid]||{});
 const orig=[];hero.traverse(o=>orig.push(o));const root=hero.clone(true);const cl=[];root.traverse(o=>cl.push(o));const idx=new Map();orig.forEach((o,i)=>idx.set(o,i));const C=o=>cl[idx.get(o)];
 const vm={};for(const k in HM)if(HM[k]&&HM[k].isMaterial)vm[k]=HM[k].clone();const swap=m=>{for(const k in HM)if(HM[k]===m)return vm[k];return m;};
 root.traverse(o=>{if(o.isMesh)o.material=swap(o.material);});for(const q of civSwap){const n=C(q.o);n.material=swap(q.orig);n.visible=true;}
 vm.suit.color.copy(lin(look.suit));if(vm.suitT)vm.suitT.color.copy(lin(look.suit));vm.armor.color.copy(lin(look.suit)).multiplyScalar(0.42);const ec=lin(look.energy||'#ff3a3a');vm.energy.color.copy(ec).lerp(new THREE.Color(1,1,1),0.35);vm.energy.emissive.copy(ec);vm.eye.emissive.copy(ec).lerp(new THREE.Color(1,1,1),0.4);vm.eye.emissiveIntensity=1.4;vm.acc.color.copy(lin(look.acc));vm.cape.color.copy(lin(look.cape));vm.mask.color.copy(lin(look.mask));vm.hair.color.copy(lin(look.hair));
 C(cape).visible=!!look.capeOn;C(maskMesh).visible=!!look.maskOn;eyes.forEach(e=>C(e).visible=!!look.maskOn);plainEyes.forEach(e=>C(e).visible=!look.maskOn);
 for(const k in heroExtras)heroExtras[k].forEach(m=>{const n=C(m);if(n)n.visible=(k===vid);});applyBodyMorph({spine:C(spine),head:C(head),hips:C(hips),armor:collectArmor().map(C)},FEMALE_HEROES.has(vid),false);applyMaillotClone(root,[C(AL.sh),C(AR.sh),C(LL.th),C(LR.th)],MAILLOT.has(vid),swap);
 root.visible=true;C(tiltG).rotation.set(0,0,0);if(VILS.length>4)root.traverse(o=>{if(o.isMesh)o.castShadow=false;});
 return{root,ec,vm,nodes:{tilt:C(tiltG),rig:C(rig),hips:C(hips),spine:C(spine),head:C(head),LLth:C(LL.th),LRth:C(LR.th),LLkn:C(LL.kn),LRkn:C(LR.kn),ALsh:C(AL.sh),ARsh:C(AR.sh),ALel:C(AL.el),ARel:C(AR.el),eyes:eyes.map(C),fists:[C(AL.fist),C(AR.fist)]}};}
function spawnVillain(slot){const vid=slot.id,H=HEROES[vid],K=VKIT[vid];const mdl=buildVillainModel(vid);
 const a=rand(0,6.283);let x=pl.pos.x+Math.cos(a)*300,z=pl.pos.z+Math.sin(a)*300;if(VERSUS){x=pl.pos.x+Math.sin(yaw)*170+Math.cos(a)*70;z=pl.pos.z+Math.cos(yaw)*170+Math.sin(a)*70;}const L=Math.hypot(x,z);if(L>1000){x*=1000/L;z*=1000/L;}
 const pos=new V3(x,K.fly?45:0,z);const e={type:'villain',vid,g:mdl.root,m:mdl,pos,vel:new V3(),hp:2200*H.hp*(K.giant?2.5:1),r:1,cy:1,t:0,tag:true,dead:false,stun:0,size:K.giant?1:1,sizeT:K.giant||1,face:a+Math.PI,ph:0,
  retT:0,atkT:3,beamT:0,burn:0,aim:new V3(),tgtPlayer:false,tgtPt:new V3(),punchW:0,stepPh:0,crushT:0,cutT:0,cutB:null,boltN:0,boltT:0};
 e.maxHp=e.hp;mdl.root.position.copy(pos);scene.add(mdl.root);e.slot=slot;enemies.push(e);slot.e=e;slot.announced=false;
 banner(slot.label+' şehre saldırıyor','Onu durdurabilecek tek kişi sensin');sfx('alert',1);renderVBars();}
function despawnVillain(slot){if(slot.e&&!slot.e.dead){slot.e.dead=true;scene.remove(slot.e.g);}slot.e=null;slot.rib.forEach(r=>r.visible=false);}
function relabelVillains(){const seen={};for(const v of VILS){seen[v.id]=(seen[v.id]||0)+1;const tot=VILS.filter(q=>q.id===v.id).length;v.label=HEROES[v.id].name+(tot>1?' '+seen[v.id]:'');}}
function addVillain(id){if(VILS.length>=VIL_MAX){toast('En fazla 30 kötü seçebilirsin','Önce birini kaldır');return;}VILS.push({id,e:null,respawnAt:time+1.5+VILS.length*1.2,kills:0,announced:false,rib:[mkRib(),mkRib()]});relabelVillains();toast(VILS[VILS.length-1].label+' kötü karakter oldu','Oyuna dönünce şehre saldıracak');renderVBars();renderHeroes();}
function removeVillain(id){for(let k=VILS.length-1;k>=0;k--)if(VILS[k].id===id){if(LOCK_E&&LOCK_E===VILS[k].e)LOCK_E=null;despawnVillain(VILS[k]);VILS.splice(k,1);break;}relabelVillains();renderVBars();renderHeroes();}
function clearVillains(){LOCK_E=null;for(const v of VILS)despawnVillain(v);VILS.length=0;renderVBars();renderHeroes();}
function renderVBars(){const box=$('vbars');if(!box)return;box.innerHTML='';for(const v of VILS){const d=document.createElement('div');d.className='vbar'+(v.e&&!v.e.dead?'':' off');d.innerHTML='<div class="vtop"><b></b><span>Kötü karakter</span><span class="vk"></span></div><div class="vtrack"><i></i></div>';d.querySelector('b').textContent=v.label;v.el=d;box.appendChild(d);}box.classList.toggle('many',VILS.length>3);}
function villainPick(e){const K=VKIT[e.vid];const dP=Math.hypot(pl.pos.x-e.pos.x,pl.pos.z-e.pos.z);e.tgtUnit=null;
 if(VERSUS){const o=nearestOtherVillain(e);if(o){e.tgtPlayer=false;e.tgtPed=null;e.tgtV=o;e.tgtPt.set(o.pos.x,o.pos.y+o.cy,o.pos.z);return;}}e.tgtV=null;
 if(MIL.units.length&&Math.random()<(civOn?0.55:0.3)){const u=nearestUnit(e.pos);if(u&&u.pos.distanceTo(e.pos)<500){e.tgtPlayer=false;e.tgtPed=null;e.tgtUnit=u;e.tgtPt.set(u.pos.x,u.pos.y+1.5,u.pos.z);return;}}
 if(!pl.dead&&state==='play'&&!civOn){e.tgtPlayer=true;return;}
 e.tgtPlayer=false;e.tgtPed=null;if(!ARENA&&(civOn||Math.random()<0.7)){let bp=null,bd2=1e18;for(let i=0;i<60;i++){const p=peds[randi(0,peds.length-1)];if(!p||p.down>0||p.gone)continue;const d=(p.x-e.pos.x)**2+(p.z-e.pos.z)**2;if(d<bd2){bd2=d;bp=p;}}
  if(bp){e.tgtPt.set(bp.x,1,bp.z);e.tgtPed=bp;return;}}
 e.tgtPlayer=false;let best=null,bd=1e9;for(let i=0;i<(ARENA?0:40);i++){const b=buildings[randi(0,buildings.length-1)];if(!b||!b.alive)continue;const d=Math.hypot(b.x-e.pos.x,b.z-e.pos.z);if(d<bd&&d>(K.giant?20:8)){bd=d;best=b;}}
 if(best)e.tgtPt.set(best.x,(best.y0||0)+best.h*rand(0.35,0.7),best.z);else e.tgtPt.set(rand(-600,600),20,rand(-600,600));}
let VERSUS=false,vsAlive=0;
function vDamage(o,d){if(!VERSUS||!o||o.dead||o.phase)return;o.hp-=d;o.hitT=0.2;if(o.hp<=0)killEnemy(o);}
function vHit(e,c,R,d){if(!VERSUS)return;for(const o of liveVillains()){if(o===e)continue;const dx=o.pos.x-c.x,dz=o.pos.z-c.z,dh=Math.hypot(dx,dz);if(dh<R+o.r&&Math.abs(o.pos.y+o.cy-c.y)<R+o.cy)vDamage(o,d*(1-0.5*dh/(R+o.r)));}}
function nearestOtherVillain(e){let b=null,bd=1e9;for(const o of liveVillains()){if(o===e)continue;const d=o.pos.distanceTo(e.pos);if(d<bd){bd=d;b=o;}}return b;}
function toggleVersus(){VERSUS=!VERSUS;for(const v of VILS)if(v.e){v.e.retT=0;v.e.tgtV=null;}renderHeroes();toast(VERSUS?'Kötüler birbiriyle savaşacak':'Kötüler yine seni avlayacak',VERSUS?'Sen izle ya da araya gir':'');}

function villainAct(slot,fn){VILLAIN_ACTING=slot;try{fn();}finally{VILLAIN_ACTING=null;}}
function updVillain(e,dt){const H=HEROES[e.vid],K=VKIT[e.vid],N=e.m.nodes;
 e.size=lerp(e.size,e.sizeT,damp(K.giant?(e.sizeT<e.size?2.2:1.1):4,dt));const S=H.scale*e.size;const KG=K.giant&&e.size>5;
 if(K.giant){e.szT=(e.szT==null?rand(9,14):e.szT)-dt;if(e.szT<=0){if(e.sizeT>1){e.sizeT=0.12;e.szT=rand(4,7);const c=new V3(e.pos.x,1,e.pos.z);fxFlash(c,1,10,0.3,'#ffd27a');sfxAt('charge',c,600,1);}
  else{e.sizeT=K.giant;e.szT=rand(9,14);const c=new V3(e.pos.x,0.5,e.pos.z);fxFlash(c.clone().setY(4),2,70,0.5,'#ffd27a');fxGroundRing(c,2,130,1,'#ffd27a');sfxAt('shock',c,900,1.2);sfxAt('collapse',c,900,0.8);addShakeAt(c,1);
   villainAct(e.slot,()=>{cityImpact(c,65*K.giant/120,30);for(const b of solidsNear(c.x,c.z).slice())if(b.alive&&boxDist(c,b.col)<50*K.giant/120)damageBuilding(b,9000,closestOnBox(c,b.col),true);});vHit(e,c.clone().setY(30),65,250);
   if(!pl.dead&&!PHASE_ON&&Math.hypot(pl.pos.x-c.x,pl.pos.z-c.z)<75*K.giant/120&&pl.pos.y<140*K.giant/120){hurt(30);const k=new V3(pl.pos.x-c.x,0,pl.pos.z-c.z).normalize().multiplyScalar(40);k.y=30;pl.vel.add(k);pl.grounded=false;}}}}e.r=0.5*S+0.6;e.cy=1.0*S;N.rig.scale.setScalar(1.04*S);
 if(e.stun>0){e.stun-=dt;e.slot.rib.forEach(r=>r.visible=false);e.beamT=0;return;}
 if(civOn&&e.tgtPlayer){e.tgtPlayer=false;e.retT=0;e.beamT=0;e.boltN=0;e.rampage=true;}if(!civOn&&e.rampage){e.rampage=false;e.retT=0;}
 e.retT-=dt;if(e.retT<=0){e.retT=civOn?rand(1.5,3):rand(2.5,4.5);villainPick(e);}if(!e.tgtPlayer&&e.tgtPed&&!e.tgtPed.down&&!e.tgtPed.gone)e.tgtPt.set(e.tgtPed.x,1,e.tgtPed.z);if(!e.tgtPlayer&&e.tgtUnit){if(e.tgtUnit.dead)e.retT=Math.min(e.retT,0.5);else e.tgtPt.set(e.tgtUnit.pos.x,e.tgtUnit.pos.y+1.5,e.tgtUnit.pos.z);}if(e.tgtV){if(e.tgtV.dead||!VERSUS){e.tgtV=null;e.retT=0;}else e.tgtPt.set(e.tgtV.pos.x,e.tgtV.pos.y+e.tgtV.cy,e.tgtV.pos.z);}else if(VERSUS&&liveVillains().length>1&&e.retT>0.3)e.retT=0.3;
 const chest=new V3(pl.pos.x,pl.pos.y+1.2*HERO.scale*SIZE,pl.pos.z);const P=e.tgtPlayer&&!pl.dead?chest:e.tgtPt;
 const to=new V3(P.x-e.pos.x,0,P.z-e.pos.z),dxz=to.length();const want=e.tgtV?(K.fly?12+S:e.r+e.tgtV.r+1.5):K.fly?(e.tgtPlayer?16+S*2:22+S):(e.tgtPlayer?e.r+2:e.r+5);
 const spd=AG().spd*(K.top?Math.min(K.top,Math.max(K.speed,dxz*5),K.speed+((e.tgtPlayer||e.tgtV)?Math.max(0,dxz-25)*8:0)):Math.min(280,K.speed+((e.tgtPlayer||e.tgtV)?Math.max(0,dxz-50)*1.4:0)));if(e.air){}else if(dxz>want&&(e.beamT<=0||dxz>140)){to.divideScalar(dxz||1);e.vel.x=lerp(e.vel.x,to.x*spd,damp(3,dt));e.vel.z=lerp(e.vel.z,to.z*spd,damp(3,dt));}else{e.vel.x=lerp(e.vel.x,0,damp(5,dt));e.vel.z=lerp(e.vel.z,0,damp(5,dt));}
 e.pos.x+=e.vel.x*dt;e.pos.z+=e.vel.z*dt;const hs=Math.hypot(e.vel.x,e.vel.z);
 if(K.fly){const ty=e.tgtPlayer?Math.max(pl.pos.y+3,14):Math.max(18,P.y+6);e.pos.y=lerp(e.pos.y,ty,damp(2.6,dt));}
 else{const gy=inRiver(e.pos.x,e.pos.z)?WATER_Y:0;e.leapCd=(e.leapCd||0)-dt;
  const tyH=e.tgtV?e.tgtV.pos.y+e.tgtV.cy:pl.pos.y;if(!e.air&&(e.tgtV||(e.tgtPlayer&&!pl.dead))&&tyH-gy>10+S*0.6&&dxz<220&&e.leapCd<=0&&e.stun<=0){const h=Math.min(300,tyH-gy+6);e.vy=Math.sqrt(2*30*h);const tf=e.vy/30*1.6,dir=new V3(P.x-e.pos.x,0,P.z-e.pos.z).normalize(),hv=Math.min(180,dxz/Math.max(0.4,tf));e.vel.set(dir.x*hv,0,dir.z*hv);e.air=true;e.leapCd=3.2;sfxAt('whoosh',e.pos,300,1);dustBurst(e.pos,16,3+S*0.3,2,3,8,1.2);}
  if(e.air){e.vy+=G*dt;e.pos.y+=e.vy*dt;if(e.pos.y<=gy&&e.vy<0){e.pos.y=gy;e.air=false;e.vel.multiplyScalar(0.2);const R=KG?40:12,c=new V3(e.pos.x,0.3,e.pos.z);fxGroundRing(c,2,R,0.6,'#ffffff');dustBurst(c,30,R*0.6,2,3,R*0.4,1.6);sfxAt('land',c,500,1);sfxAt('shock',c,500,0.6);addShakeAt(c,0.6);
   villainAct(e.slot,()=>{cityImpact(c,R,24);for(const b of solidsNear(c.x,c.z).slice())if(b.alive&&boxDist(c,b.col)<R*0.6)damageBuilding(b,KG?5000:1200,closestOnBox(c,b.col),true);});vHit(e,c,R,KG?200:80);
   if(!pl.dead&&Math.hypot(pl.pos.x-c.x,pl.pos.z-c.z)<R&&pl.pos.y<R*0.5){hurt(16);const k=new V3(pl.pos.x-c.x,0,pl.pos.z-c.z).normalize().multiplyScalar(24);k.y=12;pl.vel.add(k);pl.grounded=false;}}}
  else e.pos.y=gy;}
 const lookX=e.beamT>0?e.aim.x-e.pos.x:(hs>1?e.vel.x:P.x-e.pos.x),lookZ=e.beamT>0?e.aim.z-e.pos.z:(hs>1?e.vel.z:P.z-e.pos.z);e.face=turnAngle(e.face,Math.atan2(lookX,lookZ),damp(5,dt));e.g.rotation.y=e.face;
 if(e.thrown&&e.thrown.length){for(let k=e.thrown.length-1;k>=0;k--){const c=e.thrown[k];if(c.state!==1){e.thrown.splice(k,1);continue;}if(!pl.dead&&!PHASE_ON&&c.pos.distanceTo(chest)<3.4){hurt(20);destroyCar(c);e.thrown.splice(k,1);}}}
 e.panT=(e.panT||0)-dt;if(e.panT<=0){e.panT=1;villainAct(e.slot,()=>panicAt(e.pos));}
 /* rampage: smash through whatever is in the way */
 e.crushT-=dt;if(e.crushT<=0){e.crushT=0.12;villainAct(e.slot,()=>{const gp=new V3(e.pos.x,Math.max(0.5,e.pos.y),e.pos.z);
  for(const b of solidsNear(e.pos.x,e.pos.z).slice()){if(!b.alive)continue;if(boxDist(gp,b.col)<e.r*0.9&&(!K.fly||e.pos.y<b.col.maxY)&&(KG||hs>3)&&!e.phase)damageBuilding(b,KG?5000:900,closestOnBox(gp,b.col),true);}
  unitsNear(new V3(e.pos.x,0,e.pos.z),e.r+1,KG?9999:120);if(KG)vHit(e,new V3(e.pos.x,e.pos.y+e.cy,e.pos.z),e.r*0.8,40);if(!K.fly||e.pos.y<6){for(const p of peds){if(p.down>0||p.gone)continue;const dx=p.x-e.pos.x,dz=p.z-e.pos.z;if(dx*dx+dz*dz<(e.r+0.8)*(e.r+0.8))knockPed(p,new V3(dx,0,dz).normalize(),8+S);}
   for(const c of cars){if(c.state!==0)continue;const dx=c.pos.x-e.pos.x,dz=c.pos.z-e.pos.z;if(dx*dx+dz*dz<(e.r+1.5)*(e.r+1.5)){if(KG)destroyCar(c);else launchCar(c,new V3(dx,0,dz).normalize().multiplyScalar(20).setY(10));}}}});}
 /* attacks */
 e.atkT-=dt;const dP=chest.distanceTo(new V3(e.pos.x,e.pos.y+e.cy,e.pos.z));
 if(e.atkT<=0&&e.beamT<=0&&e.size>0.8){const kind=Math.random()<AG().hv?'havoc':pick(K.atk);e.atkT=(e.tgtPlayer?rand(0.9,1.8):rand(1.2,2.4))*AG().cd;
  if(kind==='havoc'){const B=villainBuilding(e,150);const beamKit=K.atk.includes('beam');
   if(beamKit&&B){e.havocPt=new V3(B.x,(B.y0||0)+B.h*rand(0.3,0.75),B.z);e.aim.copy(e.havocPt);e.beamT=2.4;sfxAt('charge',e.pos,400,1);}
   else{let n=0;const tp=e.tgtPlayer&&!pl.dead?chest:(B?new V3(B.x,(B.y0||0)+B.h*0.5,B.z):null);if(tp)for(const c of cars){if(n>=3)break;if(c.state!==0)continue;if(c.pos.distanceTo(e.pos)<70+e.r){const v=tp.clone().sub(c.pos);const L=v.length();v.normalize().multiplyScalar(Math.min(110,40+L*0.6));v.y+=L*0.12+6;launchCar(c,v);if(c.state===1)(e.thrown||(e.thrown=[])).push(c);n++;}}
    if(n){e.punchW=1;sfxAt('whoosh',e.pos,400,1);}
    const near=B&&boxDist(e.pos,B.col)<e.r+25;if(near){villainAct(e.slot,()=>{damageBuilding(B,KG?9000:2600,closestOnBox(e.pos,B.col),true);});e.punchW=1;sfxAt('punch',e.pos,400,1);addShakeAt(e.pos,0.4);}
    if(!n&&!near)e.atkT=0.3;}}
  else if(kind==='beam'&&(vMega(e)||(e.tgtPlayer?dP<170+S*1.2:dxz<200+S))){e.beamT=vMega(e)?4.5:1.9;e.aim.copy(P);sfxAt('charge',e.pos,300,0.9);}
  else if(kind==='slam'&&(e.tgtPlayer?dxz<e.r+14:dxz<e.r+18)){const R=(KG?62:24)*Math.sqrt(AG().des);const c=new V3(e.pos.x,0.3,e.pos.z);fxGroundRing(c,2,R*1.1,0.8,'#'+e.m.ec.getHexString());fxFlash(c.clone().setY(2),2,R*0.5,0.3,'#ffffff');dustBurst(c,40,R*0.6,2,4,R*0.4,1.8);sfxAt('shock',c,600,1);sfxAt('collapse',c,600,0.7);addShakeAt(c,KG?1:0.6);
   villainAct(e.slot,()=>{cityImpact(c,R,30);for(const b of solidsNear(c.x,c.z).slice())if(b.alive&&boxDist(c,b.col)<R*0.7)damageBuilding(b,KG?8000:2600,closestOnBox(c,b.col),true);});vHit(e,c,R,KG?260:120);
   if(!pl.dead&&Math.hypot(pl.pos.x-c.x,pl.pos.z-c.z)<R&&pl.pos.y<c.y+R*0.4){hurt(22);const k=new V3(pl.pos.x-c.x,0,pl.pos.z-c.z).normalize().multiplyScalar(30);k.y=14;pl.vel.add(k);pl.grounded=false;}}
  else if(kind==='melee'&&e.tgtPlayer&&dP<e.r+3.5+S*0.35){if(S>4&&!PHASE_ON&&!GRABBED&&Math.random()<0.6){GRABBED=e;grabT=1.6;pl.grounded=false;pl.flying=false;sfxAt('whoosh',e.pos,300,1);sfxAt('punch',e.pos,300,0.6);}else{e.punchW=1;hurt(12+S*0.4);const k=new V3(pl.pos.x-e.pos.x,0,pl.pos.z-e.pos.z).normalize().multiplyScalar(26+S);k.y=10;pl.vel.add(k);pl.grounded=false;sfxAt('punch',e.pos,200,1);addShake(0.35);}}
  else if(kind==='melee'&&e.tgtV&&dxz<e.r+e.tgtV.r+6){e.punchW=1;const tv=e.tgtV;vDamage(tv,45+S*2);const k=new V3(tv.pos.x-e.pos.x,0,tv.pos.z-e.pos.z).normalize();tv.pos.addScaledVector(k,4+S*0.15);const hc=new V3(tv.pos.x,tv.pos.y+tv.cy,tv.pos.z);sparks(hc,14,14);fxFlash(hc,0.5,3+S*0.2,0.15,'#ffffff');sfxAt('punch',e.pos,400,1);addShakeAt(e.pos,0.3);}
  else if(kind==='melee'&&!e.tgtPlayer&&dxz<e.r+8){e.punchW=1;villainAct(e.slot,()=>{for(const b of solidsNear(e.pos.x,e.pos.z).slice())if(b.alive&&boxDist(e.pos,b.col)<e.r+8)damageBuilding(b,900*S,closestOnBox(e.pos,b.col),true);});sfxAt('punch',e.pos,300,1);}
  else if(kind==='bolts'&&(e.tgtV?dxz<230:e.tgtPlayer&&dP<200)){e.boltN=5;e.boltT=0;}
  else if(kind==='blink'&&(e.tgtPlayer||e.tgtV)&&dxz>20){const smoke=p=>{for(let i=0;i<24;i++)emit(dustPS,p.x+rand(-0.6,0.6),p.y+rand(0,2),p.z+rand(-0.6,0.6),rand(-2,2),rand(0,2),rand(-2,2),rand(0.6,1.1),1,3.5,0.32,0.22,0.42,0.75,1.5,0.3);};smoke(e.pos.clone());const a=rand(0,6.283);{const bp=e.tgtV?e.tgtV.pos:pl.pos;e.pos.set(bp.x+Math.cos(a)*5,0,bp.z+Math.sin(a)*5);}smoke(e.pos.clone());sfxAt('whoosh',e.pos,200,1);e.atkT=0.6;}
  else if(kind==='whirl'&&dxz<45){const R=28,c=new V3(e.pos.x,0.5,e.pos.z);for(let i=0;i<80;i++){const a=rand(0,6.283),r=rand(2,R);emit(dustPS,c.x+Math.cos(a)*r,rand(0.5,7),c.z+Math.sin(a)*r,-Math.sin(a)*16-Math.cos(a)*5,rand(2,9),Math.cos(a)*16-Math.sin(a)*5,rand(1,1.8),1.5,5,0.85,0.88,0.9,0.55,0.6,0.5);}fxGroundRing(c,R,1,0.6,'#cfefff');sfxAt('whoosh',c,400,1);sfxAt('shock',c,400,0.6);addShakeAt(c,0.5);
   villainAct(e.slot,()=>{cityImpact(c,R,26);});vHit(e,c,R,90);if(!pl.dead&&!PHASE_ON&&Math.hypot(pl.pos.x-c.x,pl.pos.z-c.z)<R){hurt(18);const k=new V3(c.x-pl.pos.x,0,c.z-pl.pos.z).normalize().multiplyScalar(14);k.y=24;pl.vel.add(k);pl.grounded=false;}}
  else if(kind==='strike'&&(e.tgtPlayer?dP<260:dxz<320)&&!(e.strikeT>0)){e.strikeT=0.95;e.strikeP=e.tgtPlayer?chest.clone():P.clone();const sp0=e.strikeP;const gp=new V3(sp0.x,inRiver(sp0.x,sp0.z)?WATER_Y+0.2:0.3,sp0.z);fxGroundRing(gp,9,1.5,0.95,'#'+e.m.ec.getHexString());sfxAt('charge',gp,300,0.9);}
  else e.atkT=0.4;}
 if(e.boltN>0){e.boltT-=dt;if(e.boltT<=0&&(e.tgtV||dP<220)){e.boltT=0.18;e.boltN--;const f=N.fists[e.boltN%2].getWorldPosition(new V3());if(e.tgtV&&!e.tgtV.dead){const tv=e.tgtV,tp=new V3(tv.pos.x,tv.pos.y+tv.cy,tv.pos.z),v=tp.clone().sub(f),L=v.length();v.divideScalar(L);emit(glowPS,f.x,f.y,f.z,v.x*260,v.y*260,v.z*260,Math.min(1,L/260),0.5,0.3,e.m.ec.r,e.m.ec.g,e.m.ec.b,1,0,0);vDamage(tv,14);sfxAt('enemyShot',f,300,0.6);}else enemyShoot(f,7,70);}}
 if(e.strikeT>0){e.strikeT-=dt;if(e.strikeT<=0){const p=e.strikeP,top=new V3(p.x+rand(-25,25),p.y+300,p.z+rand(-25,25));for(let i=0;i<3;i++)boltFX(top,p,e.m.ec,1.2-i*0.3,0.3);fxFlash(p,3,36,0.3,'#ffffff');sparks(p,30,26);sfxAt('boom',p,600,1);sfxAt('zap',p,600,1);addShakeAt(p,0.6);
  villainAct(e.slot,()=>{cityImpact(p,10,24);for(const b of solidsNear(p.x,p.z).slice())if(b.alive&&boxDist(p,b.col)<9)damageBuilding(b,1000,closestOnBox(p,b.col),true);});vHit(e,p,8,140);if(!pl.dead&&chest.distanceTo(p)<7){hurt(24);pl.vel.y+=10;}}}
 if(e.stompT2>0){e.stompT2-=dt;if(e.stompT2<=0&&e.stompTgt){const c=e.stompTgt;fxGroundRing(c,2,14,0.6,'#'+e.m.ec.getHexString());fxFlash(c.clone().setY(2),2,8,0.3,'#ffffff');dustBurst(c,30,8,2,3,10,1.5);sfxAt('land',c,500,1);sfxAt('collapse',c,500,0.6);addShakeAt(c,0.8);villainAct(e.slot,()=>{cityImpact(c,10,24);for(const b of solidsNear(c.x,c.z).slice())if(b.alive&&boxDist(c,b.col)<9)damageBuilding(b,3000,closestOnBox(c,b.col),true);});if(!pl.dead&&!PHASE_ON&&Math.hypot(pl.pos.x-c.x,pl.pos.z-c.z)<8){hurt(26);pl.vel.y+=6;}e.stompTgt=null;}}
 /* beam */
 if(e.beamT>0){e.beamT-=dt;const tgt=e.havocPt||(e.tgtPlayer&&!pl.dead?chest:e.tgtPt);e.aim.lerp(tgt,damp(e.tgtPlayer?2.6:1.5,dt));if(!e.tgtPlayer)e.aim.x+=Math.cos(e.t*2)*0.3;
  const hands=['raven','ice','fire','storm','psychic'].includes(e.vid);const src=(hands?N.fists:N.eyes).map(n=>n.getWorldPosition(new V3()));const col=K.ice?new THREE.Color('#bfefff'):e.m.ec;
  const o=src[0].clone().add(src[1]).multiplyScalar(0.5);const dir=e.aim.clone().sub(o);const len=dir.length();dir.divideScalar(len||1);const _mg=vMega(e);const r=raycastWorld(o,dir,_mg?3640:len+40,false);const hit=o.clone().addScaledVector(dir,Math.min(r.t,_mg?Math.max(len,600):len+40));const _cl=beamClash(e,o,hit,_mg?9:0.32+0.02*S);if(_cl)hit.copy(_cl);else if(_mg)villainMegaStep(e,o,dir,hit,dt);
  e.slot.rib.forEach((rb,i)=>{rb.visible=true;placeRibbon(rb,src[i],hit,_mg?9:0.32+0.02*S);rb.material.uniforms.col.value.copy(col);rb.material.uniforms.time.value=time;rb.material.uniforms.len.value=hit.distanceTo(src[i]);rb.material.uniforms.inten.value=1;});
  if(Math.random()<0.7)emit(glowPS,hit.x,hit.y,hit.z,rand(-3,3),rand(1,5),rand(-3,3),rand(0.4,0.8),0.4,0.15,col.r,col.g,col.b,1,0.6,-10);
  if(!_cl&&!pl.dead&&hit.distanceTo(chest)<2.6){e.burn+=16*dt;if(e.burn>=4){e.burn-=4;hurt(4);}}if(!_cl&&e.tgtV&&!e.tgtV.dead){const tv=e.tgtV;if(hit.distanceTo(new V3(tv.pos.x,tv.pos.y+tv.cy,tv.pos.z))<tv.r+2.5){vDamage(tv,(K.ice?40:85)*dt);if(K.ice)tv.stun=Math.max(tv.stun||0,1.2);}}
  if(!_cl)villainAct(e.slot,()=>{if(r.b){damageBuilding(r.b,480*dt,hit.clone(),false,true);if(e.cutB!==r.b){e.cutB=r.b;e.cutT=0;}e.cutT+=dt;if(e.cutT>0.9/AG().des&&!K.ice){e.cutT=-9;sliceBuilding(r.b,hit.y,dir);if(e.havocPt){const nb=villainBuilding(e,200);if(nb){e.havocPt.set(nb.x,(nb.y0||0)+nb.h*rand(0.3,0.7),nb.z);e.beamT=Math.max(e.beamT,1.3);}}}}
   moltenT-=dt;if(moltenT<=0){moltenT=0.02;addMolten(hit,r.b?boxNormal(hit,r.b.col):UP,r.b,K.ice?1:0);}
   for(const p of peds){if(p.down>0||p.gone)continue;if(Math.abs(p.x-hit.x)<4*Math.sqrt(AG().des)&&Math.abs(p.z-hit.z)<4*Math.sqrt(AG().des)&&hit.y<4){if(K.ice)p.wait=4;else knockPed(p,dir,5);}}unitsNear(hit,3,K.ice?60*dt:260*dt);});
  if(e.beamT<=0){e.slot.rib.forEach(rb=>rb.visible=false);e.havocPt=null;}}
 if(K.top){const ph=hs>55;if(ph!==!!e.phase){e.phase=ph;for(const k in e.m.vm){const m=e.m.vm[k];if(!m.userData.o0)m.userData.o0=[m.transparent,m.opacity];m.transparent=ph?true:m.userData.o0[0];m.opacity=ph?Math.min(m.userData.o0[1],0.5):m.userData.o0[1];}}
  if(e.phase){N.rig.position.x=rand(-0.05,0.05);N.rig.position.z=rand(-0.05,0.05);if(Math.random()<0.6)emit(glowPS,e.pos.x+rand(-0.4,0.4),e.pos.y+rand(0.2,1.8),e.pos.z+rand(-0.4,0.4),0,0,0,0.18,0.25,0.05,0.75,0.92,1,0.8,0,0);if(hs>60)for(let k=0;k<2;k++)emit(glowPS,e.pos.x+rand(-0.4,0.4),e.pos.y+rand(0.3,1.6),e.pos.z+rand(-0.4,0.4),-e.vel.x*0.05,0,-e.vel.z*0.05,0.35,0.35,0.05,0.75,0.92,1,0.7,0,0);}else{N.rig.position.x=0;N.rig.position.z=0;}
  const lvl=Math.floor(hs*3.6/500);if(lvl>(e.wLvl||0)){e.wLvl=lvl;const d=new V3(e.vel.x,0,e.vel.z).normalize(),c=e.pos.clone().addScaledVector(d,-3);c.y+=1;ringFx(c,d,8+lvl*2.5,0.6,0xffffff);ringFx(c.clone().addScaledVector(d,-4),d,5+lvl*1.5,0.45,0xcfe9ff);fxFlash(c,1,6+lvl,0.18,'#ffffff');sfxAt('sonic',c,900,1);addShakeAt(c,0.25+lvl*0.04);villainAct(e.slot,()=>cityImpact(c.clone().setY(0),8+lvl*1.5,12+lvl*2));}
  else if(hs*3.6<(e.wLvl||0)*500-150)e.wLvl=Math.max(0,Math.floor((hs*3.6+150)/500));}
 /* footsteps of big walkers */
 if(!K.fly&&!e.air&&hs>1){const ph=Math.floor(e.ph/Math.PI);if(ph!==e.stepPh){e.stepPh=ph;if(S>4){sfxAt('land',e.pos,500,1);addShakeAt(e.pos,Math.min(0.5,S*0.007));dustBurst(e.pos,8,S*0.4,1,S*0.1,S*0.3,1.2);villainAct(e.slot,()=>{panicAt(e.pos);cityImpact(new V3(e.pos.x,0,e.pos.z),S*0.45*Math.sqrt(AG().des),14);});}}}
 /* animation */
 e.ph+=Math.min(30,hs/(1.2*Math.max(1,S*0.45))*Math.PI)*dt;let p;
 if(K.fly){p=hs>12?pCruise():pHover(time+e.t);N.tilt.rotation.x=lerp(N.tilt.rotation.x,clamp(hs/K.speed,0,1)*1.35,damp(4,dt));}
 else if(e.air){p=pAir(e.vy);N.tilt.rotation.x=0;}
 else{const sv=HA.ph;HA.ph=e.ph;p=pLoco(Math.min(2,hs/Math.max(4,K.speed*0.35)),0,time);HA.ph=sv;N.tilt.rotation.x=0;}
 if(e.beamT>0&&['raven','ice','fire','storm','psychic'].includes(e.vid)){p.aL=p.aR=-1.5;p.eL=p.eR=-0.05;}
 if(e.punchW>0){e.punchW=Math.max(0,e.punchW-dt*3);p.aR=lerp(p.aR,-1.65,e.punchW);p.eR=lerp(p.eR,0,e.punchW);}
 N.hips.position.y=p.hy;N.spine.rotation.x=p.lean;N.head.rotation.x=p.hd;N.LLth.rotation.x=p.tL;N.LRth.rotation.x=p.tR;N.LLkn.rotation.x=p.kL;N.LRkn.rotation.x=p.kR;N.ALsh.rotation.x=p.aL;N.ARsh.rotation.x=p.aR;N.ALel.rotation.x=p.eL;N.ARel.rotation.x=p.eR;N.ALsh.rotation.z=p.zL;N.ARsh.rotation.z=-p.zR;}
/* ---------- lock-on to the villain (R) ---------- */
let LOCK_E=null;
const liveVillains=()=>VILS.filter(v=>v.e&&!v.e.dead).map(v=>v.e);
function toggleLock(){const L=liveVillains();if(!L.length){LOCK_E=null;$('lockR').classList.add('hidden');toast('Kötü karakter yok','Kahramanlar ekranından birini "Kötü yap" ile seç');return;}
 if(!LOCK_E||LOCK_E.dead){L.sort((a,b)=>a.pos.distanceTo(pl.pos)-b.pos.distanceTo(pl.pos));LOCK_E=L[0];}else{const k=L.indexOf(LOCK_E);LOCK_E=k<0?L[0]:(k===L.length-1?null:L[k+1]);}
 if(!LOCK_E)$('lockR').classList.add('hidden');toast(LOCK_E?'Kilitlendi':'Kilit açıldı',LOCK_E?LOCK_E.slot.label+(L.length>1?' · R ile sıradakine geç':''):'');sfx('click',1);}
function lockSteer(dt){if(!LOCK_E)return;let V=LOCK_E;if(V.dead){const L=liveVillains();LOCK_E=L.length?L[0]:null;V=LOCK_E;}if(!V||pl.dead){LOCK_E=null;$('lockR').classList.add('hidden');return;}
 const d=new V3(V.pos.x,V.pos.y+V.cy*0.9,V.pos.z).sub(camPivot);const L=d.length();if(L<1)return;d.divideScalar(L);
 yaw=turnAngle(yaw,Math.atan2(d.x,d.z),damp(9,dt));pitch=lerp(pitch,clamp(-Math.asin(clamp(d.y,-1,1)),-1.25,1.35),damp(9,dt));}
function lockReticle(){const el=$('lockR');const V=LOCK_E;if(!V||V.dead||state!=='play'){el.classList.add('hidden');return;}
 const top=new V3(V.pos.x,V.pos.y+V.cy*2,V.pos.z).project(camera),bot=new V3(V.pos.x,V.pos.y,V.pos.z).project(camera),mid=new V3(V.pos.x,V.pos.y+V.cy,V.pos.z).project(camera);
 if(mid.z>1||mid.z<-1){el.classList.add('hidden');return;}el.classList.remove('hidden');const W=innerWidth,H=innerHeight;const x=(mid.x*0.5+0.5)*W,y=(-mid.y*0.5+0.5)*H;const h=Math.abs(top.y-bot.y)*0.5*H;const sz=clamp(h*1.15,46,Math.min(W,H)*0.8);
 el.style.width=el.style.height=sz+'px';el.style.transform='translate('+(x-sz/2)+'px,'+(y-sz/2)+'px)';$('lockD').textContent=V.slot.label+' · '+Math.round(V.pos.distanceTo(pl.pos))+' m';}

function villainTick(dt){lockReticle();
 VILS.forEach((v,k)=>{const e=v.e;
  if(!e&&!v.done&&state==='play'&&time>v.respawnAt){spawnVillain(v);}
  if(e&&e.dead&&!v.announced){v.announced=true;if(prog.st)prog.st.vill++;v.rib.forEach(r=>r.visible=false);banner(v.label+' yenildi',liveVillains().length?'Ama şehirde hâlâ kötüler var':'Şehir şimdilik güvende');v.done=true;if(v.el)v.el.classList.add('off');}
  if(v.el&&e&&!e.dead){v.el.classList.remove('off');v.el.querySelector('i').style.width=Math.max(0,e.hp/e.maxHp*100)+'%';v.el.querySelector('.vk').textContent='Kurbanları: '+v.kills.toLocaleString('tr-TR');}});
 if(VERSUS){const n=liveVillains().length;if(vsAlive>=2&&n===1){const w=liveVillains()[0];banner(w.slot.label+' kazandı!','Kapışmanın galibi şimdi sana dönüyor');}vsAlive=n;}
 let gone=false;for(let k=VILS.length-1;k>=0;k--){const v=VILS[k];if(v.done&&time>(v.doneT||(v.doneT=time+3))){if(LOCK_E===v.e)LOCK_E=null;v.rib.forEach(r=>{r.visible=false;scene.remove(r);});VILS.splice(k,1);gone=true;}}if(gone){relabelVillains();renderVBars();renderHeroes();}}

/* ---------- three more heroes: fire, telekinesis, lightning ---------- */
heroExtras.fire=[];heroExtras.psychic=[];heroExtras.storm=[];heroExtras.brute=[];
/* winged hero extras: a pair of large feathered wings on the back */
heroExtras.wing=[];let WING_RIG=null;
{const featherM=new THREE.MeshStandardMaterial({color:lin(0xf2f4f8),roughness:0.7,metalness:0,side:THREE.DoubleSide});
 const WINGS=[];for(const s of[1,-1]){const root=new THREE.Group();root.position.set(s*0.12,0.5,-0.08);spine.add(root);root.visible=false;heroExtras.wing.push(root);WINGS.push({root,s});
  let par=root;const segs=[[0.5,0.14,-0.2],[0.52,0.12,-0.1],[0.5,0.1,-0.05],[0.44,0.085,0]];let i=0;
  for(const [len,w,droop] of segs){const g=new THREE.Group();g.position.set(s*(i?len*0.9:0.1),i?0:0.02,0);par.add(g);
   for(let f=0;f<5;f++){const fl=new THREE.Mesh(new THREE.PlaneGeometry(len,w),featherM);fl.position.set(s*len*0.5,-f*w*0.5-droop*f*0.15,-f*0.02);fl.rotation.set(-Math.PI/2+0.15,0,s*(-0.1-f*0.05));fl.castShadow=true;g.add(fl);heroExtras.wing.push(fl);}
   g.rotation.z=s*(-0.25+i*0.08);par=g;i++;}
  WINGS[WINGS.length-1].joints=[];let p2=root;while(p2&&p2.children.length){const gg=p2.children.find(c=>c.type==='Group');if(!gg)break;WINGS[WINGS.length-1].joints.push(gg);p2=gg;}}
  WING_RIG=WINGS;}
let scopeK=0;
function animateWings(dt){if(HERO_ID!=='wing'||!WING_RIG)return;const hs=Math.hypot(pl.vel.x,pl.vel.z),fast=pl.flying?1:0;
 const flap=Math.sin(time*(pl.flying?6:2.2))*(pl.flying?0.5:0.12);
 for(const W of WING_RIG){const spread=pl.flying?1:0.35;W.root.rotation.z=W.s*(-0.2-spread*0.5)+W.s*flap;W.root.rotation.x=-0.1-spread*0.3;W.joints.forEach((j,i)=>{j.rotation.z=W.s*(-0.25+i*0.08)+W.s*flap*(0.5+i*0.2);});}}

{for(const s of[1,-1]){const f=hadd(new THREE.ConeGeometry(0.05,0.22,7).translate(0,0.11,0),HM.energy,s>0?AL.sh:AR.sh,0,0.06,0);f.rotation.z=-s*0.35;heroExtras.fire.push(f);
  const b=hadd(new THREE.TorusGeometry(0.052,0.012,8,20).rotateX(Math.PI/2),HM.energy,s>0?AL.el:AR.el,0,-0.16,0);heroExtras.fire.push(b);
  const coil=hadd(new THREE.CylinderGeometry(0.035,0.035,0.14,10),HM.armor,s>0?AL.sh:AR.sh,0,0.08,-0.02);heroExtras.storm.push(coil);
  for(let k=0;k<3;k++){const r=hadd(new THREE.TorusGeometry(0.05,0.008,6,18).rotateX(Math.PI/2),HM.energy,s>0?AL.el:AR.el,0,-0.12-k*0.04,0);heroExtras.storm.push(r);}}
 heroExtras.psychic.push(hadd(new THREE.SphereGeometry(0.016,12,8),HM.energy,head,0,0.075,0.105));
 const crown=hadd(new THREE.TorusGeometry(0.15,0.006,6,48).rotateX(Math.PI/2),HM.energy,head,0,0.2,0);heroExtras.psychic.push(crown);
 for(const k of['fire','psychic','storm'])heroExtras[k].forEach(m=>m.visible=false);}
/* lightning bolts drawn from a pool of beam ribbons */
const BOLTS=[];for(let i=0;i<48;i++){const r=ribbons[0].clone();r.material=ribbons[0].material.clone();LIN_MATS.push(r.material);r.visible=false;scene.add(r);BOLTS.push({r,life:0});}let boltIdx=0;
function boltFX(a,b,col,w,life){const segs=7,dir=b.clone().sub(a),L=dir.length();if(L<0.5)return;const p1=new V3(-dir.z,0,dir.x);if(p1.lengthSq()<1e-4)p1.set(1,0,0);p1.normalize();const p2=new V3().crossVectors(dir,p1).normalize();
 const pts=[a.clone()];for(let i=1;i<segs;i++){const t=i/segs;pts.push(a.clone().addScaledVector(dir,t).addScaledVector(p1,rand(-1,1)*L*0.05).addScaledVector(p2,rand(-1,1)*L*0.05));}pts.push(b.clone());
 for(let i=0;i<segs;i++){const B=BOLTS[boltIdx];boltIdx=(boltIdx+1)%BOLTS.length;B.life=life;B.r.visible=true;placeRibbon(B.r,pts[i],pts[i+1],w);const u=B.r.material.uniforms;u.col.value.copy(col);u.len.value=pts[i].distanceTo(pts[i+1]);u.inten.value=1.4;u.time.value=time;}}
function updateBolts(dt){for(const B of BOLTS){if(B.life>0){B.life-=dt;if(B.life<=0)B.r.visible=false;}}}
let altT=0;const tkRib=(()=>{const r=ribbons[0].clone();r.material=ribbons[0].material.clone();LIN_MATS.push(r.material);r.visible=false;scene.add(r);return r;})();
function handsPos(){return AL.fist.getWorldPosition(new V3()).add(AR.fist.getWorldPosition(new V3())).multiplyScalar(0.5);}
function updateAltPowers(dt){updateLifted(dt);if(HERO.rmb==='tk'&&!mouseR&&LIFTED.length){const d=camFwd.clone().normalize();for(const L of LIFTED)if(L.phase==='held'||L.phase==='rise')throwLifted(L,d);}const k=HERO.rmb,on=!PHOTO&&state==='play'&&mouseR&&pl.en>1&&!pl.dead&&!civOn&&(k==='fire'||k==='tk'||k==='chain');tkRib.visible=false;if(!on)return;pl.en=Math.max(0,pl.en-15*dt);altT-=dt;const ec=HM.energy.emissive;
 if(k==='fire'){const src=handsPos(),d=camFwd.clone();for(let i=0;i<12;i++){const v=d.clone().multiplyScalar(rand(34,50)).add(new V3(rand(-3.5,3.5),rand(-3,3.5),rand(-3.5,3.5))),t=Math.random();emit(glowPS,src.x,src.y,src.z,v.x,v.y,v.z,rand(0.55,0.85),rand(0.3,0.7),rand(1.6,3),1,lerp(0.78,0.3,t),0.1,1,0.4,2);}
  if(Math.random()<0.5)emit(dustPS,src.x+d.x*20,src.y+d.y*20+1,src.z+d.z*20,rand(-1,1),rand(2,4),rand(-1,1),1.6,1,4,0.25,0.22,0.2,0.5,0.5,0.3);
  if(Math.random()<0.25)sfx('whoosh',0.25);
  if(altT<=0){altT=0.1;const R=38;for(const e of enemies){if(e.dead)continue;const v=new V3(e.pos.x,e.pos.y+e.cy,e.pos.z).sub(src);const L=v.length();if(L<R+e.r&&v.normalize().dot(d)>0.93)damageEnemy(e,20*ST.dmg,null);}
   for(const p of peds){if(p.down>0||p.gone)continue;const v=new V3(p.x,1,p.z).sub(src);const L=v.length();if(L<R&&v.normalize().dot(d)>0.95)knockPed(p,d,4);}
   for(const c of cars){if(c.state!==0)continue;const v=c.pos.clone().sub(src);const L=v.length();if(L<R&&v.normalize().dot(d)>0.95&&Math.random()<0.2)destroyCar(c);}
   const r=raycastWorld(src,d,R,false);if(r.b&&r.t<R){const hp=src.clone().addScaledVector(d,r.t);damageBuilding(r.b,30*ST.dmg,hp,false,true);addMolten(hp,boxNormal(hp,r.b.col),r.b,0);addScorch(hp,boxNormal(hp,r.b.col),r.b);}
   else if(r.t<R){const hp=src.clone().addScaledVector(d,r.t);addMolten(hp,UP,null,0);addScorch(hp,UP,null);}}}
 else if(k==='tk'){const tgt=aim.point,src=head.getWorldPosition(new V3());if(!ARENA&&aim.b&&aim.b.alive&&!aim.b._lifted&&LIFTED.length<3)liftBuilding(aim.b);placeRibbon(tkRib,src,tgt,0.12);tkRib.visible=true;const u=tkRib.material.uniforms;u.col.value.copy(ec);u.len.value=src.distanceTo(tgt);u.time.value=time;u.inten.value=0.6;
  for(let i=0;i<4;i++){const a=rand(0,6.283),r=rand(2,9);emit(glowPS,tgt.x+Math.cos(a)*r,tgt.y+rand(0,3),tgt.z+Math.sin(a)*r,-Math.sin(a)*6,rand(3,7),Math.cos(a)*6,0.6,0.35,0.1,ec.r,ec.g,ec.b,1,0,0);}
  for(const L of LIFTED){if(L.phase==='rise'&&Math.abs(L.y-L.riseY)<6)L.phase='held';if(L.phase==='held'){const gp=camera.position.clone().addScaledVector(camFwd,Math.max(40,aim.point.distanceTo(camera.position)));L.goal=new V3(gp.x,Math.max((L.b.y0||0)+L.h*0.5+8,gp.y),gp.z);}}
  if(altT<=0){altT=0.25;const R=10,f=camFwd.clone().setY(0).normalize();
   for(const c of cars){if(c.state!==0)continue;if(c.pos.distanceTo(tgt)<R)launchCar(c,new V3(f.x*16,rand(16,22),f.z*16));}
   for(const e of enemies){if(e.dead)continue;if(e.pos.distanceTo(tgt)<R+e.r)damageEnemy(e,25*ST.dmg,new V3(f.x*10,20,f.z*10));}
   for(const p of peds){if(p.down>0||p.gone)continue;if(Math.hypot(p.x-tgt.x,p.z-tgt.z)<R)knockPed(p,f,8);}sfx('whoosh',0.4);}}
 else if(k==='chain'){const src=AR.fist.getWorldPosition(new V3()),tgt=aim.point;boltFX(src,tgt,ec,0.2,0.06);if(Math.random()<0.5)boltFX(src,tgt,ec,0.12,0.05);if(Math.random()<0.6)sparks(tgt,4,10);
  if(altT<=0){altT=0.08;sfx('zap',0.35);if(aim.e)damageEnemy(aim.e,16*ST.dmg,null);if(aim.ped)knockPed(aim.ped,camFwd,3);if(aim.b)damageBuilding(aim.b,40*ST.dmg,tgt.clone(),false,true);
   let n=0;for(const e of enemies){if(n>=3)break;if(e.dead||e===aim.e)continue;const ep=new V3(e.pos.x,e.pos.y+e.cy,e.pos.z);if(ep.distanceTo(tgt)<18){boltFX(tgt,ep,ec,0.14,0.1);damageEnemy(e,12*ST.dmg,null);n++;}}
   for(const p of peds){if(n>=4)break;if(p.down>0||p.gone)continue;if(Math.hypot(p.x-tgt.x,p.z-tgt.z)<14){boltFX(tgt,new V3(p.x,1.1,p.z),ec,0.12,0.1);knockPed(p,camFwd,3);n++;}}
   for(const c of cars){if(n>=5)break;if(c.state!==0)continue;if(c.pos.distanceTo(tgt)<12){boltFX(tgt,c.pos.clone().setY(c.pos.y+1),ec,0.12,0.1);if(Math.random()<0.3)destroyCar(c);n++;}}}}}
/* telekinesis: lift a whole building into the air and slam it down */
const LIFTED=[];
function liftBuilding(b){if(!b||!b.alive)return false;if(b._lifted)return true;
 const mats=b.outer?oMats[b.si]:b.mesh.material,geo=b.outer?new THREE.BoxGeometry(b.w,b.h,b.d):(b.cyl?cylBuildingGeo(Math.min(b.w,b.d)/2,b.h):buildingGeo(b.w,b.h,b.d));
 const m=new THREE.Mesh(geo,mats);m.castShadow=m.receiveShadow=true;m.position.set(b.x,(b.y0||0)+b.h/2,b.z);scene.add(m);
 clearMarks&&clearMarks(b);clearScorch&&clearScorch(b);b.alive=false;b._lifted=true;scene.remove(b.mesh);if(b.col)b.col.maxY=-999;
 for(const k of b.kids||[])if(k.alive)collapseBuilding(k);
 LIFTED.push({m,b,x:b.x,z:b.z,baseY:(b.y0||0)+b.h/2,y:(b.y0||0)+b.h/2,vy:0,spin:rand(-0.5,0.5),rot:0,phase:'rise',riseY:(b.y0||0)+b.h/2+40+b.h*0.6,w:Math.max(b.w,b.d),h:b.h,color:b.wallColor});
 prog.destroyed++;return true;}
function slamLifted(L){L.phase='slam';L.thrown=false;L.vy=-120;L.vx=0;L.vz=0;}
function throwLifted(L,dir){L.phase='slam';L.thrown=true;const sp=150;L.vx=dir.x*sp;L.vz=dir.z*sp;L.vy=dir.y*sp+10;}
function updateLifted(dt){for(let i=LIFTED.length-1;i>=0;i--){const L=LIFTED[i];L.rot+=L.spin*dt;L.m.rotation.y=L.rot;L.m.rotation.z=Math.sin(L.rot*0.7)*0.08;
  if(L.phase==='rise'){L.y=lerp(L.y,L.riseY,damp(2.5,dt));L.m.position.set(L.x,L.y,L.z);if(Math.random()<0.5)emit(glowPS,L.x+rand(-L.w/2,L.w/2),L.y+rand(-L.h/2,L.h/2),L.z+rand(-L.w/2,L.w/2),0,rand(-1,2),0,0.6,0.5,0.15,0.77,0.54,1,0.8,0,0);}
  else if(L.phase==='held'){if(L.goal){L.x=lerp(L.x,L.goal.x,damp(5,dt));L.y=lerp(L.y,L.goal.y,damp(5,dt));L.z=lerp(L.z,L.goal.z,damp(5,dt));}L.m.position.set(L.x,L.y,L.z);if(Math.random()<0.3)emit(glowPS,L.x+rand(-L.w/2,L.w/2),L.y+rand(-L.h/2,L.h/2),L.z+rand(-L.w/2,L.w/2),0,rand(0,2),0,0.6,0.4,0.12,0.77,0.54,1,0.7,0,0);}
  else{L.vy+=G*(L.thrown?1:1.4)*dt;L.x+=(L.vx||0)*dt;L.z+=(L.vz||0)*dt;L.y+=L.vy*dt;L.m.position.set(L.x,L.y,L.z);if(L.thrown&&Math.random()<0.6)emit(glowPS,L.x+rand(-L.w/2,L.w/2),L.y+rand(-L.h/2,L.h/2),L.z+rand(-L.w/2,L.w/2),0,0,0,0.5,0.4,0.12,0.77,0.54,1,0.7,0,0);
   let hitB=false;if(L.thrown)for(const ob of solidsNear(L.x,L.z))if(ob.alive&&L.x>ob.col.minX-2&&L.x<ob.col.maxX+2&&L.z>ob.col.minZ-2&&L.z<ob.col.maxZ+2&&L.y<ob.col.maxY+4){hitB=true;break;}
   if(L.y<=(L.b.y0||0)+L.h*0.3||hitB){const p=new V3(L.x,0.5,L.z);scene.remove(L.m);L.m.geometry.dispose&&L.m.geometry.dispose();LIFTED.splice(i,1);
    fxFlash(p.clone().setY(3),3,Math.min(60,L.w*2),0.5,'#c58bff');fxGroundRing(p,2,Math.min(80,L.w*2.5),0.9,'#c58bff');dustBurst(p,60,L.w*1.2,3,4,L.w*0.5,2.2);spawnDebris(p.clone().setY(2),80,L.w*0.8,0.7,3,L.color,1.4);
    sfxAt('collapse',p,600,1.1);sfxAt('boom',p,600,0.8);addShakeAt(p,1);
    const R=Math.max(22,L.w*2);cityImpact(p,R,40);for(const ob of solidsNear(L.x,L.z).slice())if(ob.alive&&boxDist(p,ob.col)<R*0.6)damageBuilding(ob,9000,closestOnBox(p,ob.col),true);
    for(const e of (enemies||[]))if(!e.dead&&e.pos.distanceTo(p)<R){const k=e.pos.clone().sub(p).setY(0).normalize().multiplyScalar(30);k.y=20;damageEnemy(e,300,k);}}}}}

function tryPush(){if(pl.dead||pl.cd.shock>0||pl.en<30)return;pl.cd.shock=4;pl.en-=30;pl.shockT=time;const f=camFwd.clone(),o=pl.pos.clone();o.y+=1.4;const R=70,ec=HM.energy.emissive;
 fxDome(o.clone().addScaledVector(f,6),2,14,0.4,ec.clone());for(let i=0;i<80;i++){const v=f.clone().multiplyScalar(rand(30,60)).add(new V3(rand(-14,14),rand(-8,10),rand(-14,14)));emit(glowPS,o.x,o.y,o.z,v.x,v.y,v.z,rand(0.5,0.9),0.5,0.2,ec.r,ec.g,ec.b,1,1,0);}
 const inCone=p=>{const v=p.clone().sub(o);const L=v.length();return L<R&&L>0.5&&v.divideScalar(L).dot(f)>0.6?L:0;};
 for(const c of cars){if(c.state!==0)continue;const L=inCone(c.pos);if(L)launchCar(c,f.clone().multiplyScalar(48*(1-L/R)+18).setY(14));}
 for(const e of enemies){if(e.dead)continue;const L=inCone(e.pos);if(L)damageEnemy(e,60*ST.dmg,f.clone().multiplyScalar(40).setY(14));}
 for(const p of peds){if(p.down>0||p.gone)continue;const L=inCone(new V3(p.x,1,p.z));if(L)knockPed(p,f,20*(1-L/R)+6);}
 for(const b of solidsNear(o.x,o.z).slice()){if(!b.alive)continue;const cp=closestOnBox(o,b.col);if(inCone(cp)&&cp.distanceTo(o)<30)damageBuilding(b,500*ST.dmg,cp,true);}
 addShake(0.35);sfx('shock',0.8);sfx('whoosh',1);}
function tryThunder(){if(pl.dead||pl.cd.shock>0||pl.en<30)return;pl.cd.shock=3;pl.en-=30;pl.shockT=time;const p=aim.point.clone(),ec=HM.energy.emissive;const top=new V3(p.x+rand(-30,30),p.y+320,p.z+rand(-30,30));
 for(let i=0;i<3;i++)boltFX(top,p,ec,1.3-i*0.3,0.3+i*0.05);for(let i=0;i<4;i++){const a=rand(0,6.283);boltFX(p,p.clone().add(new V3(Math.cos(a)*rand(6,12),rand(0,3),Math.sin(a)*rand(6,12))),ec,0.3,0.25);}
 fxFlash(p,3,40,0.35,'#ffffff');fxGroundRing(p,1,22,0.6,'#'+ec.getHexString());sparks(p,40,30);dustBurst(p,20,6,2,3,10,1.4);sfx('boom',1);sfx('zap',1);addShakeAt(p,0.7);
 cityImpact(p,12,26);splash(p,14,170*ST.dmg,null);for(const b of solidsNear(p.x,p.z).slice())if(b.alive&&boxDist(p,b.col)<10)damageBuilding(b,1200*ST.dmg,closestOnBox(p,b.col),true);}

/* ---------- impact craters: falling from great height blasts a crater into the city ---------- */
const soilTex=cv(256,256,(g,w,h)=>{g.fillStyle='#6b665e';g.fillRect(0,0,w,h);for(let i=0;i<2600;i++){const v=Math.round(rand(60,140));g.fillStyle='rgba('+v+','+Math.round(v*0.95)+','+Math.round(v*0.88)+','+rand(0.2,0.6).toFixed(2)+')';g.fillRect(rand(0,w),rand(0,h),rand(1,5),rand(1,5));}
 g.strokeStyle='rgba(20,18,16,.75)';for(let i=0;i<40;i++){g.lineWidth=rand(0.6,2);g.beginPath();let x=rand(0,w),y=rand(0,h);g.moveTo(x,y);for(let k=0;k<6;k++){x+=rand(-24,24);y+=rand(-24,24);g.lineTo(x,y);}g.stroke();}});
soilTex.wrapS=soilTex.wrapT=THREE.RepeatWrapping;soilTex.repeat.set(8,3);
const craterMat=new THREE.MeshStandardMaterial({map:soilTex,vertexColors:true,roughness:0.96,metalness:0});
const RUB_PER=70,CRATER_MAX=8;const rubbleI=new THREE.InstancedMesh(lumpy(1,0.3),M(0x7d7870,0.9,{flatShading:true}),RUB_PER*CRATER_MAX);rubbleI.castShadow=rubbleI.receiveShadow=true;rubbleI.frustumCulled=false;for(let i=0;i<RUB_PER*CRATER_MAX;i++)rubbleI.setMatrixAt(i,ZM);scene.add(rubbleI);let craterSlot=0;
function makeCrater(p,H){const R=clamp(7+Math.sqrt(H)*1.7,10,75),h=R*0.16,c=new V3(p.x,0.5,p.z);
 fxFlash(c.clone().setY(3),5,R*1.2,0.5,'#fff2d0');fxGroundRing(c,R*0.3,R*2.2,1.1,'#ffffff');ringFx(c,UP,R*1.6,0.8,0xffffff);sfx('boom',1.2);sfx('collapse',1);sfx('sonic',0.7);addShake(1.2);hitStop=Math.max(hitStop,0.12);
 if(inRiver(p.x,p.z)){for(let i=0;i<220;i++){const a=rand(0,6.283),s=rand(4,30);emit(dustPS,p.x,WATER_Y+0.5,p.z,Math.cos(a)*s,rand(10,45),Math.sin(a)*s,rand(1.5,3),1.5,5,0.86,0.92,0.96,0.75,0.4,1.8);}cityImpact(c,R,35);return;}
 if(p.y>2.5){for(const b of solidsNear(p.x,p.z).slice()){if(b.alive&&p.x>b.col.minX-1&&p.x<b.col.maxX+1&&p.z>b.col.minZ-1&&p.z<b.col.maxZ+1)damageBuilding(b,30000,p.clone(),true);}dustBurst(p,40,R*0.5,3,4,R*0.3,2);return;}
 const pts=[];const NP=28;for(let i=0;i<=NP;i++){const q=i/NP*1.45;const y=q<=1?0.2+h*Math.pow(q,2.4):h*Math.pow(Math.max(0,1-(q-1)/0.45),1.6);pts.push(new THREE.Vector2(Math.max(0.001,q*R),y));}
 const g=new THREE.LatheGeometry(pts,72),pa=g.attributes.position,col=new Float32Array(pa.count*3),seed=rand(0,100);
 for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i),r=Math.hypot(x,z),q=r/R,a=Math.atan2(z,x);const n=Math.sin(a*7+seed)*0.5+Math.sin(a*13+seed*2)*0.3+Math.sin(a*3+r*0.3)*0.4;
  const rimK=Math.exp(-Math.pow((q-1)/0.18,2));pa.setY(i,Math.max(0,y+n*h*0.2*rimK+(q<1?n*0.12*q:0)));
  const cc=q<0.5?[0.07,0.06,0.05]:q<1?[0.12+0.26*(q-0.5),0.11+0.24*(q-0.5),0.1+0.22*(q-0.5)]:[Math.max(0.22,0.4-0.3*(q-1)),Math.max(0.22,0.39-0.3*(q-1)),Math.max(0.23,0.37-0.28*(q-1))];col.set(cc,i*3);}
 g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();
 const m=new THREE.Mesh(g,craterMat);m.position.set(p.x,0,p.z);m.receiveShadow=true;m.castShadow=true;scene.add(m);
 const C={x:p.x,z:p.z,R,h,R2o:(R*1.45)*(R*1.45),m,slot:craterSlot,t:0};craterSlot=(craterSlot+1)%CRATER_MAX;craters.push(C);
 if(craters.length>CRATER_MAX){const o=craters.shift();scene.remove(o.m);o.m.geometry.dispose();}
 for(let k=0;k<RUB_PER;k++){const a=rand(0,6.283),r=R*rand(0.75,1.4),s=rand(0.4,1.7)*R/26;dm.position.set(p.x+Math.cos(a)*r,craterH(C,r)+s*0.3,p.z+Math.sin(a)*r);dm.rotation.set(rand(0,3),rand(0,3),rand(0,3));dm.scale.set(s,s*rand(0.5,1),s*rand(0.7,1.2));dm.updateMatrix();rubbleI.setMatrixAt(C.slot*RUB_PER+k,dm.matrix);}dm.rotation.set(0,0,0);rubbleI.instanceMatrix.needsUpdate=true;
 if(!ARENA)for(const arr of[buildings,outer])for(const b of arr){if(!b.alive)continue;const d=boxDist(c,b.col);if(d<R*1.15)damageBuilding(b,d<R*0.7?30000:2500*(1-d/(R*1.15))+300,closestOnBox(c,b.col),true);}
 cityImpact(c,R*1.4,45);splash(c,R*1.2,400*ST.dmg,null);fxDome(c,R*0.2,R*1.5,0.8,new THREE.Color(1,0.9,0.75));
 for(let k=0;k<40;k++){const a=rand(0,6.283),r=rand(0.3,1.4)*R;dustBurst(new V3(p.x+Math.cos(a)*r,1,p.z+Math.sin(a)*r),2,R*0.15,3,6,R*0.3,3);}
 spawnDebris(c.clone().setY(2),60,Math.min(40,R*0.6),0.6,3,0x6b665e,1.2);for(let k=0;k<36;k++)addMolten(new V3(p.x+rand(-R*0.35,R*0.35),0.28,p.z+rand(-R*0.35,R*0.35)),UP,null,0);
 if(prog.st)prog.st.craters++;toast('Krater','Çap '+Math.round(R*2)+' m');}
function updateCraters(dt){for(const C of craters){if(C.t>12)continue;C.t+=dt;const k=1-C.t/12;if(Math.random()<k*1.5)emit(dustPS,C.x+rand(-C.R*0.3,C.R*0.3),1,C.z+rand(-C.R*0.3,C.R*0.3),rand(-1,1),rand(3,7),rand(-1,1),rand(3,5),C.R*0.08,C.R*0.25,0.3,0.28,0.26,0.6*k,0.3,0.4);
 if(Math.random()<k)emit(glowPS,C.x+rand(-C.R*0.25,C.R*0.25),0.6,C.z+rand(-C.R*0.25,C.R*0.25),rand(-1,1),rand(2,6),rand(-1,1),0.8,0.3,0.1,1,0.5,0.15,1,0,-2);}}

/* ---------- police and military response to super-villains ---------- */
const MIL={units:[],phase:0,threatT:0,policeDead:0,calmT:0,dispT:0,jetT:0,gunT:0,gunN:0,shells:[]};let MIL_ACTING=false;
function colorMerge(parts){let n=0;const gs=parts.map(([g,c])=>{const q=g.index?g.toNonIndexed():g;n+=q.attributes.position.count;return[q,new THREE.Color(c).convertSRGBToLinear()];});
 const P=new Float32Array(n*3),Nn=new Float32Array(n*3),C=new Float32Array(n*3);let o=0;for(const [q,c] of gs){const k=q.attributes.position.count;P.set(q.attributes.position.array,o*3);Nn.set(q.attributes.normal.array,o*3);for(let i=0;i<k;i++)C.set([c.r,c.g,c.b],(o+i)*3);o+=k;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(Nn,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));return g;}
const MIL_MAT=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.75,metalness:0.1});
const BX=(w,h,d,x,y,z)=>new THREE.BoxGeometry(w,h,d).translate(x,y,z);
function personGeo(cop){const U=cop?0x1d2a44:0x4a5a36,P=cop?0x1a2236:0x4a5a36,S=0xd9a77f;const parts=[[BX(0.16,0.85,0.18,0.1,0.43,0),P],[BX(0.16,0.85,0.18,-0.1,0.43,0),P],[BX(0.17,0.12,0.27,0.1,0.06,0.04),0x111111],[BX(0.17,0.12,0.27,-0.1,0.06,0.04),0x111111],
 [BX(0.42,0.6,0.24,0,1.15,0),U],[BX(0.11,0.11,0.5,0.17,1.32,0.24),U],[BX(0.11,0.11,0.5,-0.15,1.32,0.24),U],[new THREE.SphereGeometry(0.11,10,8).translate(0,1.6,0),S],[new THREE.CylinderGeometry(0.06,0.07,0.1,8).translate(0,1.47,0),S]];
 if(cop){parts.push([new THREE.CylinderGeometry(0.125,0.12,0.07,12).translate(0,1.72,0),0x141c2e],[BX(0.2,0.02,0.1,0,1.69,0.12),0x0c0c0c],[BX(0.05,0.1,0.2,0.02,1.33,0.56),0x111111],[BX(0.44,0.1,0.26,0,0.88,0),0x101010]);}
 else{parts.push([new THREE.SphereGeometry(0.14,12,8,0,Math.PI*2,0,Math.PI/2).translate(0,1.63,0),0x3d4a2c],[BX(0.46,0.46,0.3,0,1.18,0),0x2f3a24],[BX(0.06,0.09,0.9,0.02,1.33,0.55),0x1a1a1a],[BX(0.04,0.14,0.05,0.02,1.25,0.4),0x1a1a1a]);}
 return colorMerge(parts);}
const COP_G=personGeo(true),SOL_G=personGeo(false);
const PCAR_G=colorMerge([[BX(1.9,0.7,4.4,0,0.6,0),0xf2f2f0],[BX(1.92,0.2,4.42,0,0.62,0),0x1f4fa8],[BX(1.7,0.55,2.2,0,1.2,-0.2),0x1b2533],[BX(1.75,0.08,2.3,0,1.5,-0.2),0xf2f2f0],[BX(0.9,0.05,0.4,0,1.15,1.25),0x1f4fa8],
 ...[[-0.95,1.3],[0.95,1.3],[-0.95,-1.4],[0.95,-1.4]].map(([x,z])=>[new THREE.CylinderGeometry(0.36,0.36,0.26,12).rotateZ(Math.PI/2).translate(x,0.36,z),0x111111])]);
const TANK_G=colorMerge([[BX(3.4,1.1,6.4,0,0.95,0),0x56603f],[BX(0.85,1.0,6.8,1.75,0.55,0),0x2a2a24],[BX(0.85,1.0,6.8,-1.75,0.55,0),0x2a2a24],[BX(3.2,0.3,1.2,0,1.3,2.9),0x4d5638]]);
const TURRET_G=colorMerge([[BX(2.4,0.85,2.9,0,0,0),0x5d6844],[new THREE.CylinderGeometry(0.13,0.15,4.4,10).rotateX(Math.PI/2).translate(0,0.05,3.6),0x3f4730],[BX(0.6,0.5,0.6,0.6,0.55,-0.6),0x4a5436]]);
const JET_G=colorMerge([[new THREE.CylinderGeometry(0.55,0.75,12,12).rotateX(Math.PI/2),0x8b939c],[new THREE.ConeGeometry(0.55,3,12).rotateX(Math.PI/2).translate(0,0,7.5),0x7d858e],[new THREE.SphereGeometry(0.5,12,8).scale(0.9,0.8,2.2).translate(0,0.55,3.2),0x1b2633],
 [BX(10.5,0.16,3.0,0,-0.1,-0.8),0x8b939c],[BX(4.2,0.12,1.4,0,0,-5.3),0x8b939c],[BX(0.14,2.2,1.8,0.7,1.1,-5.1),0x7d858e],[BX(0.14,2.2,1.8,-0.7,1.1,-5.1),0x7d858e]]);
const SIREN_R=new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,0.1,0.1)}),SIREN_B=new THREE.MeshBasicMaterial({color:new THREE.Color(0.1,0.3,2.6)}),SIREN_OFF=new THREE.MeshBasicMaterial({color:0x222226});
function milMesh(g){const m=new THREE.Mesh(g,MIL_MAT);m.castShadow=true;m.receiveShadow=true;return m;}
const nearRoad=v=>-HALF+clamp(Math.round((v+HALF)/PITCH),0,N)*PITCH;
function approachPath(vx,vz,dist,stop){const alongZ=Math.random()<0.5,cx=nearRoad(vx),cz=nearRoad(vz);let sg=Math.random()<0.5?1:-1;
 if(alongZ){if(Math.abs(vz+sg*dist)>1200)sg=-sg;return{start:new V3(cx,0,vz+sg*dist),end:new V3(cx,0,vz+sg*stop),dir:new V3(0,0,-sg)};}
 if(Math.abs(vx+sg*dist)>1200)sg=-sg;return{start:new V3(vx+sg*dist,0,cz),end:new V3(vx+sg*stop,0,cz),dir:new V3(-sg,0,0)};}
const gy0=(x,z)=>inRiver(x,z)?WATER_Y:0;
function addUnit(u){u.t=0;u.dead=false;u.g.position.copy(u.pos);scene.add(u.g);MIL.units.push(u);return u;}
function spawnPoliceCar(v){const P=approachPath(v.pos.x,v.pos.z,300,rand(50,70));const g=new THREE.Group();g.add(milMesh(PCAR_G));const lr=new THREE.Mesh(BX(0.5,0.16,0.3,-0.35,1.62,-0.2),SIREN_R),lb=new THREE.Mesh(BX(0.5,0.16,0.3,0.35,1.62,-0.2),SIREN_B);g.add(lr,lb);
 const lane=new V3(-P.dir.z,0,P.dir.x).multiplyScalar(2.2);P.start.add(lane);P.end.add(lane);addUnit({kind:'pcar',g,lr,lb,pos:P.start.clone(),dir:P.dir,end:P.end,hp:260,speed:38,deployed:false,sirenT:0});}
function spawnSquad(v,n){const P=approachPath(v.pos.x,v.pos.z,230,rand(105,140));const side=new V3(-P.dir.z,0,P.dir.x);for(let i=0;i<n;i++){const g=new THREE.Group();g.add(milMesh(SOL_G));const st=P.end.clone().addScaledVector(side,(i%2?1:-1)*rand(8,13)).addScaledVector(P.dir,-rand(0,18));
 addUnit({kind:'soldier',g,pos:P.start.clone().addScaledVector(side,(i%2?1:-1)*rand(2,5)).addScaledVector(P.dir,-i*3),stand:st,hp:80,speed:6.5,fireT:rand(0.5,2)});}}
function spawnTank(v){const P=approachPath(v.pos.x,v.pos.z,320,rand(140,175));const g=new THREE.Group();g.add(milMesh(TANK_G));const tur=milMesh(TURRET_G);tur.position.y=1.95;g.add(tur);addUnit({kind:'tank',g,tur,pos:P.start.clone(),dir:P.dir,end:P.end,hp:900,speed:13,fireT:rand(2,4)});}
function spawnJet(){const g=new THREE.Group();g.add(milMesh(JET_G));const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:flareTex,color:0xffa050,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));fl.position.z=-6.4;fl.scale.setScalar(3.2);g.add(fl);
 const u=addUnit({kind:'jet',g,pos:new V3(0,-999,0),hp:9999,wait:rand(0.5,3),vel:new V3(),fired:false,snd:false});u.g.visible=false;return u;}
function startPass(u,v){const a=rand(0,6.283),d=new V3(Math.cos(a),0,Math.sin(a));u.pos.set(v.pos.x,0,v.pos.z).addScaledVector(d,-1000);u.pos.y=Math.max(110,v.pos.y+60);u.vel.copy(d).multiplyScalar(240);u.tgt=v;u.fired=false;u.snd=false;u.g.visible=true;u.g.lookAt(u.pos.clone().add(d));u.passT=8.5;}
function nearestVillain(p,maxD){let b=null,bd=maxD||1e9;for(const e of liveVillains()){const d=e.pos.distanceTo(p);if(d<bd){bd=d;b=e;}}return b;}
function nearestUnit(p){let b=null,bd=1e9;for(const u of MIL.units){if(u.dead||u.kind==='jet')continue;const d=u.pos.distanceTo(p);if(d<bd){bd=d;b=u;}}return b;}
function milDamage(e,d){if(!e||e.dead||e.phase)return;e.hp-=d;e.hitT=0.15;if(e.hp<=0)killEnemy(e);}
function unitHit(u,d){if(u.dead||u.kind==='jet')return;u.hp-=d;if(u.hp>0)return;u.dead=true;u.deadT=0;const c=u.pos.clone();c.y+=1;
 if(u.kind==='pcar'||u.kind==='tank'){fireBurst(c,u.kind==='tank'?40:24,u.kind==='tank'?14:9);flashAt(c,u.kind==='tank'?8:4);sfxAt('boom',c,400,u.kind==='tank'?1:0.7);spawnDebris(c,u.kind==='tank'?20:10,12,0.3,1.4,0x3a3a36);u.g.traverse(o=>{if(o.isMesh&&o.material===MIL_MAT){o.material=o.material.clone();o.material.color.setRGB(0.12,0.11,0.1);}});if(u.lr)u.lr.visible=u.lb.visible=false;}
 else{if(VILLAIN_ACTING)VILLAIN_ACTING.kills++;else if(!MIL_ACTING)bumpKills(1);if(u.kind==='cop')MIL.policeDead++;else MIL.policeDead+=0.5;}}
function unitsImpact(pt,r,force){for(const u of MIL.units){if(u.dead||u.kind==='jet')continue;const d=Math.hypot(u.pos.x-pt.x,u.pos.z-pt.z);if(d>r+(u.kind==='soldier'||u.kind==='cop'?0:2.5))continue;if(u.kind==='tank')unitHit(u,force*8*(1-d/(r+2.5))+40);else if(u.kind==='pcar')unitHit(u,force*6+60);else unitHit(u,999);}}
function unitsNear(p,r,d){for(const u of MIL.units){if(u.dead||u.kind==='jet')continue;if(u.pos.distanceTo(p)<r+(u.kind==='tank'?3:u.kind==='pcar'?2:0))unitHit(u,d);}}
function gunShot(u,T,dmg,spread){const mz=u.pos.clone().add(new V3(Math.sin(u.g.rotation.y)*0.9,1.33,Math.cos(u.g.rotation.y)*0.9));const tp=new V3(T.pos.x+rand(-spread,spread),T.pos.y+T.cy*rand(0.6,1.4),T.pos.z+rand(-spread,spread));const v=tp.clone().sub(mz);const L=v.length();v.divideScalar(L);
 emit(glowPS,mz.x,mz.y,mz.z,0,0,0,0.05,0.35,0.05,1,0.85,0.4,1,0,0);emit(glowPS,mz.x,mz.y,mz.z,v.x*420,v.y*420,v.z*420,Math.min(0.8,L/420),0.18,0.12,1,0.8,0.45,1,0,0);
 if(Math.random()<0.75)milDamage(T,dmg);if(MIL.gunN<5){MIL.gunN++;sfxAt('gun',mz,320,u.kind==='soldier'?0.5:0.4);}}
function fireShell(u,T){const tip=new V3(0,0.05,6).applyQuaternion(u.tur.getWorldQuaternion(new THREE.Quaternion())).add(u.tur.getWorldPosition(new V3()));const tp=new V3(T.pos.x,T.pos.y+T.cy,T.pos.z).add(T.vel?T.vel.clone().multiplyScalar(0.4):new V3());
 const v=tp.clone().sub(tip).normalize().multiplyScalar(280);MIL.shells.push({pos:tip.clone(),vel:v,life:3,tgt:T});dustBurst(tip,8,2,1,1.5,4,0.8);fxFlash(tip,0.5,3.5,0.12,'#ffd28a');sfxAt('cannon',tip,500,0.9);}
function updateShells(dt){for(let i=MIL.shells.length-1;i>=0;i--){const s=MIL.shells[i];s.life-=dt;const prev=s.pos.clone();s.pos.addScaledVector(s.vel,dt);emit(glowPS,s.pos.x,s.pos.y,s.pos.z,0,0,0,0.12,0.5,0.2,1,0.7,0.3,1,0,0);
  let hit=s.life<=0||s.pos.y<=gy0(s.pos.x,s.pos.z)+0.2;const T=s.tgt;if(T&&!T.dead&&new V3(T.pos.x,T.pos.y+T.cy,T.pos.z).distanceTo(s.pos)<T.r+3)hit=true;
  if(!hit)for(const b of solidsNear(s.pos.x,s.pos.z)){if(b.alive&&s.pos.x>b.col.minX&&s.pos.x<b.col.maxX&&s.pos.z>b.col.minZ&&s.pos.z<b.col.maxZ&&s.pos.y<b.col.maxY){hit=true;break;}}
  if(hit){const p=s.pos;fireBurst(p,26,11);fxFlash(p,1,9,0.25,'#ffcf8a');sfxAt('boom',p,450,0.8);addShakeAt(p,0.25);for(const e of liveVillains()){const d=new V3(e.pos.x,e.pos.y+e.cy,e.pos.z).distanceTo(p);if(d<e.r+9)milDamage(e,150*(1-d/(e.r+9))+50);}
   MIL_ACTING=true;try{cityImpact(p,5,16);for(const b of solidsNear(p.x,p.z).slice())if(b.alive&&boxDist(p,b.col)<5)damageBuilding(b,320,closestOnBox(p,b.col),true);}finally{MIL_ACTING=false;}MIL.shells.splice(i,1);}}}
function updateMilitary(dt){if(MIL.units.length){for(const mu of MIL.units)scene.remove(mu.g);MIL.units.length=0;MIL.shells.length=0;MIL.phase=0;}{const mb=$('milbar');if(mb)mb.classList.add('hidden');}return;const L=liveVillains();MIL.gunN=0;
 if(L.length){MIL.threatT+=dt;MIL.calmT=0;}else{MIL.calmT+=dt;if(MIL.calmT>10&&MIL.units.length){for(const u of MIL.units)scene.remove(u.g);MIL.units.length=0;MIL.shells.length=0;if(MIL.phase>0)banner(MIL.phase>1?'Ordu çekildi':'Polis olay yerinden ayrıldı','Tehlike geçti');MIL.phase=0;MIL.threatT=0;MIL.policeDead=0;}}
 if(state==='play'&&L.length){if(MIL.phase===0&&MIL.threatT>4){MIL.phase=1;banner('Polis olay yerine geliyor','Kötüleri durdurmaya çalışacaklar');}
  if(MIL.phase===1&&(MIL.policeDead>=6||MIL.threatT>50)){MIL.phase=2;banner('Ordu çağrıldı','Polis durduramadı: askerler, tanklar ve savaş uçakları geliyor');sfx('alert',1);}
  MIL.dispT-=dt;if(MIL.dispT<=0&&MIL.phase>0){MIL.dispT=2.2;const cnt=k=>MIL.units.filter(u=>u.kind===k&&!u.dead).length,v=pick(L);
   if(cnt('pcar')<(MIL.phase>1?2:4))spawnPoliceCar(v);else if(MIL.phase>1&&cnt('soldier')<12)spawnSquad(v,4);else if(MIL.phase>1&&cnt('tank')<2)spawnTank(v);else if(MIL.phase>1&&cnt('jet')<2)spawnJet();}}
 for(let i=MIL.units.length-1;i>=0;i--){const u=MIL.units[i];u.t+=dt;
  if(u.dead){u.deadT+=dt;if(u.kind==='cop'||u.kind==='soldier'){u.g.rotation.x=Math.max(-Math.PI/2,u.g.rotation.x-dt*5);if(u.deadT>6){scene.remove(u.g);MIL.units.splice(i,1);}}else{if(Math.random()<0.4)emit(dustPS,u.pos.x+rand(-1,1),u.pos.y+1.5,u.pos.z+rand(-1,1),rand(-0.5,0.5),rand(2,4),rand(-0.5,0.5),2.5,1.5,5,0.12,0.12,0.12,0.6,0.3,0.4);if(u.deadT>25){scene.remove(u.g);MIL.units.splice(i,1);}}continue;}
  const T=nearestVillain(u.pos,u.kind==='jet'?3000:450);
  if(u.kind==='pcar'){if(!u.deployed){const to=u.end.clone().sub(u.pos);const d=to.length();if(d>0.5){u.pos.addScaledVector(u.dir,Math.min(d,u.speed*dt));}else{u.deployed=true;const side=new V3(-u.dir.z,0,u.dir.x);for(const s of[-1,1]){const g=new THREE.Group();g.add(milMesh(COP_G));addUnit({kind:'cop',g,pos:u.pos.clone().addScaledVector(side,s*1.8).addScaledVector(u.dir,-2.6),hp:60,fireT:rand(0.3,1.5),car:u});}}
    u.sirenT-=dt;if(u.sirenT<=0){u.sirenT=7;sfxAt('siren',u.pos,350,0.7);}}
   const on=Math.floor(time*6)%2===0;u.lr.material=on?SIREN_R:SIREN_OFF;u.lb.material=on?SIREN_OFF:SIREN_B;u.pos.y=gy0(u.pos.x,u.pos.z);u.g.position.copy(u.pos);u.g.rotation.y=Math.atan2(u.dir.x,u.dir.z);}
  else if(u.kind==='cop'||u.kind==='soldier'){if(u.stand){const to=u.stand.clone().sub(u.pos);to.y=0;const d=to.length();if(d>0.6){u.pos.addScaledVector(to.divideScalar(d),Math.min(d,u.speed*dt));u.g.rotation.y=Math.atan2(to.x,to.z);u.g.position.y=u.pos.y+Math.abs(Math.sin(u.t*9))*0.06;}else u.stand=null;}
   u.pos.y=gy0(u.pos.x,u.pos.z);u.g.position.x=u.pos.x;u.g.position.z=u.pos.z;if(!u.stand)u.g.position.y=u.pos.y;
   if(T&&!u.stand){u.g.rotation.y=Math.atan2(T.pos.x-u.pos.x,T.pos.z-u.pos.z);u.fireT-=dt;if(u.fireT<=0&&T.pos.distanceTo(u.pos)<300){if(u.kind==='cop'){u.fireT=rand(0.45,0.9);gunShot(u,T,3,2.5);}else{u.burst=(u.burst||0)+1;u.fireT=u.burst%5?0.11:rand(0.6,1.3);gunShot(u,T,2.6,2);}}}}
  else if(u.kind==='tank'){const to=u.end.clone().sub(u.pos);const d=to.length();if(d>0.5){u.pos.addScaledVector(u.dir,Math.min(d,u.speed*dt));if(Math.random()<0.3)emit(dustPS,u.pos.x-u.dir.x*3.4,0.4,u.pos.z-u.dir.z*3.4,rand(-1,1),rand(0,1),rand(-1,1),1.2,1,3,0.45,0.42,0.38,0.5,0.6,0.2);}
   u.pos.y=gy0(u.pos.x,u.pos.z);u.g.position.copy(u.pos);u.g.rotation.y=Math.atan2(u.dir.x,u.dir.z);
   if(T){const want=Math.atan2(T.pos.x-u.pos.x,T.pos.z-u.pos.z)-u.g.rotation.y;u.tur.rotation.y=turnAngle(u.tur.rotation.y,want,damp(2.5,dt));u.fireT-=dt;if(u.fireT<=0&&T.pos.distanceTo(u.pos)<420){u.fireT=rand(2.8,4.2);fireShell(u,T);}}}
  else if(u.kind==='jet'){if(!u.g.visible){u.wait-=dt;if(u.wait<=0&&T)startPass(u,T);continue;}u.pos.addScaledVector(u.vel,dt);u.passT-=dt;u.g.position.copy(u.pos);u.g.rotation.z=Math.sin(u.t*1.3)*0.15;
   if(!u.snd&&u.pos.distanceTo(camera.position)<420){u.snd=true;sfxAt('jet',u.pos,900,1);}
   if(!u.fired&&T){const to=new V3(T.pos.x,T.pos.y+T.cy,T.pos.z).sub(u.pos);if(to.length()<650&&to.dot(u.vel)>0){u.fired=true;for(let k=0;k<2;k++){const p=spawnProj({kind:'rocket',pos:u.pos.clone().add(new V3(k?2.5:-2.5,-0.6,0)),vel:u.vel.clone().multiplyScalar(0.6),size:0.3,mat:rocketMat,life:6,dmg:90,owner:0});if(p){p.target=T;p.tpt=new V3(T.pos.x,T.pos.y+T.cy,T.pos.z);p.speed=260;p.delay=k*0.15;p.mil=true;}}}}
   if(u.passT<=0){u.g.visible=false;u.wait=rand(3,6);}}
  if(u.kind!=='jet'&&!T&&u.t>12&&u.pos.distanceTo(camera.position)>180){scene.remove(u.g);MIL.units.splice(i,1);}}
 updateShells(dt);
 const hb=$('milbar');if(hb){if(MIL.phase>0&&MIL.units.length){const c=k=>MIL.units.filter(u=>u.kind===k&&!u.dead).length;hb.classList.remove('hidden');hb.innerHTML='';const t=document.createElement('b');t.textContent=MIL.phase>1?'Askerî operasyon':'Polis müdahalesi';hb.appendChild(t);
   for(const [k,n] of[['cop','Polis'],['soldier','Asker'],['tank','Tank'],['jet','Savaş uçağı']]){const v=c(k);if(!v)continue;const sp=document.createElement('span');sp.textContent=n+' '+v;hb.appendChild(sp);}}else hb.classList.add('hidden');}}

/* burning buildings left behind by villains */
const FIRES=[];
function igniteAt(pt,b){if(FIRES.length>=36)FIRES.shift();FIRES.push({p:pt.clone(),b,t:rand(10,18)});}
function villainBuilding(e,R){if(ARENA)return null;let best=null,bd=R;for(const b of buildings){if(!b.alive)continue;const d=Math.hypot(b.x-e.pos.x,b.z-e.pos.z);if(d<bd&&d>e.r*0.5){bd=d;best=b;}}return best;}
function updateFires(dt){for(let i=FIRES.length-1;i>=0;i--){const f=FIRES[i];f.t-=dt;if(f.t<=0||(f.b&&!f.b.alive)){FIRES.splice(i,1);continue;}const k=Math.min(1,f.t/3);
 for(let n=0;n<2;n++)emit(glowPS,f.p.x+rand(-1.5,1.5),f.p.y+rand(-0.5,1),f.p.z+rand(-1.5,1.5),rand(-0.6,0.6),rand(2,5),rand(-0.6,0.6),rand(0.5,0.9),rand(0.8,1.6)*k,0.2,1,rand(0.35,0.6),0.08,1,0.2,1.5);
 if(Math.random()<0.6)emit(dustPS,f.p.x+rand(-1,1),f.p.y+1.5,f.p.z+rand(-1,1),rand(-0.5,0.5),rand(3,6),rand(-0.5,0.5),rand(3,5),1.5,6,0.16,0.15,0.14,0.65*k,0.25,0.5);}}

/* ---------- Brute powerhouse (original green giant) ---------- */
heroExtras.brute=[];
{const rockM=M(0x3f6b34,0.95,{flatShading:true});const X=heroExtras.brute;const add=(g,p,x,y,z,s,sy,sz)=>{const o=hadd(g,rockM,p,x,y,z,s,sy||s,sz||s);o.rotation.set(rand(0,3),rand(0,3),0);X.push(o);return o;};
 for(const [par,x,y,z,s] of[[spine,0.2,0.5,0.02,0.2],[spine,-0.2,0.5,0.02,0.2],[spine,0,0.6,-0.12,0.16],[spine,0.13,0.3,-0.1,0.12],[spine,-0.13,0.3,-0.1,0.12],[spine,0,0.22,0.16,0.1],[AL.sh,0.03,0.04,0,0.14],[AR.sh,-0.03,0.04,0,0.14],[AL.el,0,-0.14,-0.02,0.1],[AR.el,0,-0.14,-0.02,0.1],[hips,0.16,-0.02,0,0.11],[hips,-0.16,-0.02,0,0.11],[LL.kn,0,-0.14,0.05,0.1],[LR.kn,0,-0.14,0.05,0.1]])add(lumpy(1,0.26),par,x,y,z,s,s*0.85,s);
 const jaw=hadd(new THREE.BoxGeometry(0.11,0.05,0.09),M(0x355c2c,0.9),head,0,-0.07,0.08);X.push(jaw);
 X.forEach(m=>m.visible=false);}
function tryBruteSmash(){if(pl.dead||civOn||pl.cd.shock>0)return;pl.cd.shock=6;pl.punchT=time;pl.combo=0;pl.punchDone=true;
 const ok=pl.grounded;if(!ok){pl.vel.y=-120;toast('Yere in','Yıkıcı darbe sadece yerdeyken işe yarar');return;}
 const c=pl.pos.clone();c.y+=0.5;const R=ARENA?80:Math.max(200,HALF*0.55);
 for(let w=0;w<3;w++)setTimeout(()=>{fxGroundRing(pl.pos,2,R*(0.5+w*0.3),1.1,'#6fd13a');fxGroundRing(pl.pos,2,R*(0.3+w*0.25),0.9,'#ffffff');},w*110);
 fxDome(c,2,R*0.5,0.8,new THREE.Color(0.5,0.9,0.3));fxFlash(c.clone().setY(4),4,R*0.3,0.5,'#9fff6a');flashAt(c,14);
 addShake(1.6);hitStop=Math.max(hitStop,0.14);sfx('boom',1.3);sfx('collapse',1.2);sfx('sonic',0.9);
 if(!ARENA){const all=[...buildings,...outer];let hit=0;for(const b of all){if(!b.alive)continue;const d=Math.hypot(b.x-pl.pos.x,b.z-pl.pos.z);if(d<R){const delay=d/R*700;setTimeout(()=>{if(b.alive){damageBuilding(b,99999,new V3(b.x,(b.y0||0)+1,b.z),true);}},delay);hit++;}}
  for(let k=0;k<60;k++){const a=rand(0,6.283),r=rand(0.2,1)*R;setTimeout(()=>dustBurst(new V3(pl.pos.x+Math.cos(a)*r,1,pl.pos.z+Math.sin(a)*r),2,14,3,5,R*0.15,3),r/R*700);}
  toast('Yıkıcı darbe',hit+' bina yıkıldı');}
 cityImpact(pl.pos,R,60);for(const e of enemies){if(e.dead)continue;const d=e.pos.distanceTo(pl.pos);if(d<R){const k=e.pos.clone().sub(pl.pos).setY(0).normalize().multiplyScalar(60);k.y=40;damageEnemy(e,400*ST.dmg,k);}}
 spawnDebris(c,120,R*0.4,0.8,4,0x6b665e,1.5);}

/* Kesici: a single power — a colossal cutting laser (level 1-5) that slices many buildings at once */
let LBLV=3,megaFired=false,megaCD=0,megaSliceT=0;
function vMega(e){return e.vid==='blade'&&AGG>=AGG_LV.length-1;}
function villainMegaStep(e,o,dir,hit,dt){const lv=20,half=2+lv*3.2,reach=240+lv*170;
 const f=new V3(dir.x,0,dir.z);if(f.lengthSq()<1e-4)f.set(0,0,1);f.normalize();
 // player caught inside the corridor burns fast
 if(!pl.dead){const dx=pl.pos.x-o.x,dz=pl.pos.z-o.z,al=dx*f.x+dz*f.z;if(al>1&&al<reach&&Math.abs(-dx*f.z+dz*f.x)<half*0.35&&Math.abs(pl.pos.y-hit.y)<half*0.6){e.burn+=140*dt;while(e.burn>=10){e.burn-=10;hurt(10);}}}
 e.megaSl=(e.megaSl||0)-dt;if(ARENA||e.megaSl>0)return;e.megaSl=0.12;
 villainAct(e.slot,()=>{const ycAbs=hit.y;let n=0;const cap=5+lv*5,hits=[];
  for(const b of buildings){if(!b.alive)continue;const dx=b.x-o.x,dz=b.z-o.z,al=dx*f.x+dz*f.z;if(al<2||al>reach)continue;if(Math.abs(-dx*f.z+dz*f.x)<half+Math.max(b.w,b.d)*0.5)hits.push({b,al});}
  hits.sort((a,b)=>a.al-b.al);for(const h of hits){if(n>=cap)break;const b=h.b;sliceBuilding(b,Math.max((b.y0||0)+3,Math.min(Math.max(ycAbs,(b.y0||0)+3),(b.y0||0)+b.h*0.85)),dir);n++;}
  for(const ob of outer){if(!ob.alive)continue;const dx=ob.x-o.x,dz=ob.z-o.z,al=dx*f.x+dz*f.z;if(al<2||al>reach)continue;if(Math.abs(-dx*f.z+dz*f.x)<half)damageBuilding(ob,99999,new V3(ob.x,(ob.y0||0)+1,ob.z),true);}
  for(const c of cars){if(c.state!==0)continue;const dx=c.pos.x-o.x,dz=c.pos.z-o.z,al=dx*f.x+dz*f.z;if(al>2&&al<reach&&Math.abs(-dx*f.z+dz*f.x)<half)destroyCar(c);}
  for(const p of peds){if(p.down>0||p.gone)continue;const dx=p.x-o.x,dz=p.z-o.z,al=dx*f.x+dz*f.z;if(al>2&&al<reach&&Math.abs(-dx*f.z+dz*f.x)<half*0.6)knockPed(p,f,8);}});
 for(let k=0;k<6;k++)emit(glowPS,hit.x+rand(-half,half)*0.3,hit.y+rand(0,4),hit.z+rand(-half,half)*0.3,rand(-4,4),rand(1,6),rand(-4,4),0.5,3.5,0.15,1,0.4,0.1,1,0.4,-6);}

function megaCutStep(dt){if(ARENA)return;const lv=LBLV,src=pl.pos.clone();src.y+=1.2*HERO.scale*SIZE;const o=camFwd.clone();
 const half=2+lv*3.2,reach=240+lv*170,ycAbs=aim.point.y>3?aim.point.y:src.y;
 const f=new V3(o.x,0,o.z);if(f.lengthSq()<1e-4)f.set(0,0,1);f.normalize();
 megaSliceT-=dt;if(megaSliceT<=0){megaSliceT=0.12;let n=0;const cap=5+lv*5;
  const hits=[];for(const b of buildings){if(!b.alive)continue;const dx=b.x-src.x,dz=b.z-src.z,along=dx*f.x+dz*f.z;if(along<2||along>reach)continue;const perp=Math.abs(-dx*f.z+dz*f.x);if(perp<half+Math.max(b.w,b.d)*0.5)hits.push({b,along});}
  hits.sort((a,b)=>a.along-b.along);for(const h of hits){if(n>=cap)break;const b=h.b;sliceBuilding(b,Math.max((b.y0||0)+3,Math.min(ycAbs,(b.y0||0)+b.h*0.85)),o);n++;}
  // also shred outer-district blocks and cars in the corridor
  for(const ob of outer){if(!ob.alive)continue;const dx=ob.x-src.x,dz=ob.z-src.z,along=dx*f.x+dz*f.z;if(along<2||along>reach)continue;if(Math.abs(-dx*f.z+dz*f.x)<half)damageBuilding(ob,99999,new V3(ob.x,(ob.y0||0)+1,ob.z),true);}
  for(const c of cars){if(c.state!==0)continue;const dx=c.pos.x-src.x,dz=c.pos.z-src.z,along=dx*f.x+dz*f.z;if(along>2&&along<reach&&Math.abs(-dx*f.z+dz*f.x)<half)destroyCar(c);}}
 // molten scar + sparks sweeping the ground line
 const hp=src.clone().addScaledVector(f,Math.min(reach,aim.point.clone().sub(src).dot(f)||reach));
 for(let k=0;k<2+lv;k++)emit(glowPS,hp.x+rand(-half,half),hp.y+rand(0,4),hp.z+rand(-half,half),rand(-4,4),rand(1,6),rand(-4,4),0.5,0.5+lv*0.15,0.15,1,0.4,0.1,1,0.4,-6);}

function megaCut(){const lv=LBLV,o=camFwd.clone(),src=pl.pos.clone();src.y+=1.2*HERO.scale*SIZE;
 const half=2+lv*3.5,reach=260+lv*160,ycAbs=aim.point.y>3?aim.point.y:src.y;
 const f=new V3(o.x,0,o.z);if(f.lengthSq()<1e-4)f.set(0,0,1);f.normalize();
 const hits=[];for(const b of buildings){if(!b.alive)continue;const dx=b.x-src.x,dz=b.z-src.z,along=dx*f.x+dz*f.z;if(along<2||along>reach)continue;const perp=Math.abs(-dx*f.z+dz*f.x);if(perp<half+Math.max(b.w,b.d)*0.5)hits.push({b,along});}
 hits.sort((a,b)=>a.along-b.along);const N=Math.min(hits.length,28+lv);
 for(let i=0;i<N;i++){const b=hits[i].b,yc=Math.min(ycAbs,(b.y0||0)+b.h*0.8);setTimeout(()=>{if(b.alive)sliceBuilding(b,Math.max((b.y0||0)+3,yc),o);},i*22);}
 // giant beam flash along the corridor
 const beamEnd=src.clone().addScaledVector(f,reach);const mid=src.clone().addScaledVector(f,reach*0.5);
 for(const rb of ribbons){placeRibbon(rb,src,beamEnd,0.6+lv*1.1);rb.visible=true;rb.material.uniforms.time.value=time;rb.material.uniforms.col.value.copy(new THREE.Color(costume.energy||'#ff3a3a'));rb.material.uniforms.len.value=reach;rb.material.uniforms.inten.value=2;rb._mega=time;}
 fxFlash(src.clone().addScaledVector(f,8),2,10+lv*6,0.4,'#fff2d0');fxFlash(mid,2,20+lv*10,0.5,costume.energy||'#ff3a3a');
 for(let k=0;k<40;k++){const t=rand(0,reach);emit(glowPS,src.x+f.x*t,ycAbs+rand(-half,half),src.z+f.z*t,rand(-3,3),rand(1,5),rand(-3,3),rand(0.4,0.9),0.5+lv*0.2,0.15,1,0.4,0.1,1,0.4,-6);}
 addShake(0.3+lv*0.12);sfx('zap',1);sfx('boom',0.5+lv*0.1);sfx('collapse',0.6);
 megaCD=0.5;}

/* İkiz: clone power — spawn controllable duplicates that follow or attack on command */
const ALLIES=[],ALLY_MAX=6;let allyMode='follow';
function spawnAlly(){if(HERO_ID!=='twin'||pl.dead||civOn){return;}if(ALLIES.length>=ALLY_MAX){toast('En fazla '+ALLY_MAX+' klon','Önce dağıt (3)');return;}
 const mdl=buildVillainModel('twin');mdl.root.scale.setScalar(1);scene.add(mdl.root);
 const a=rand(0,6.283),pos=pl.pos.clone().add(new V3(Math.cos(a)*3,0,Math.sin(a)*3));
 ALLIES.push({g:mdl.root,m:mdl,N:mdl.nodes,pos,vel:new V3(),ph:rand(0,6),face:pl.facing,hp:400,atkT:rand(0,0.6),beamT:0,t:0,slot:ALLIES.length});
 const c=pos.clone();c.y+=1;fxFlash(c,0.4,3,0.25,'#8be0ff');fxGroundRing(pos,0.5,4,0.4,'#8be0ff');for(let i=0;i<20;i++)emit(glowPS,pos.x,pos.y+1,pos.z,rand(-3,3),rand(0,4),rand(-3,3),0.5,0.4,0.1,0.5,0.85,1,0.9,0,0);
 sfx('charge',0.6);sfx('whoosh',0.5);toast('Klon ('+ALLIES.length+'/'+ALLY_MAX+')','1: saldır · 2: yanımda dur · 3: dağıt');}
function clearAllies(){for(const a of ALLIES){scene.remove(a.g);}ALLIES.length=0;}
function allyCommand(m){if(!ALLIES.length){toast('Klon yok','Q ile klon yarat');return;}allyMode=m;toast(m==='attack'?'Klonlar saldırıyor':'Klonlar yanında',m==='attack'?'En yakın düşmana saldırıyorlar':'Seni takip ediyorlar');}
function updateAllies(dt){if(!ALLIES.length)return;const foes=liveVillains?liveVillains():[];
 for(let i=ALLIES.length-1;i>=0;i--){const a=ALLIES[i];a.t+=dt;if(a.hp<=0){const c=a.pos.clone();c.y+=1;fxFlash(c,0.4,4,0.3,'#8be0ff');for(let k=0;k<16;k++)emit(glowPS,c.x,c.y,c.z,rand(-3,3),rand(0,4),rand(-3,3),0.5,0.4,0.1,0.5,0.85,1,0.9,0,0);scene.remove(a.g);ALLIES.splice(i,1);continue;}
  let tgt=null;if(allyMode==='attack'&&foes.length){let bd=1e9;for(const e of foes){const d=e.pos.distanceTo(a.pos);if(d<bd){bd=d;tgt=e;}}}
  let goal,want,atkRange=false;
  if(tgt){goal=new V3(tgt.pos.x,tgt.pos.y+tgt.cy*0.5,tgt.pos.z);want=tgt.r+3;}
  else{const ang=a.slot/Math.max(1,ALLIES.length)*6.283+time*0.2;goal=pl.pos.clone().add(new V3(Math.cos(ang)*4.5,0,Math.sin(ang)*4.5));want=0.5;}
  const to=goal.clone().sub(a.pos);const dist=to.length();if(dist>want){to.multiplyScalar(1/dist);const sp=tgt?42:Math.min(60,22+dist*2);a.vel.lerp(to.multiplyScalar(sp),damp(3,dt));}else a.vel.lerp(new V3(0,0,0),damp(6,dt));
  a.pos.addScaledVector(a.vel,dt);const gy=inRiver(a.pos.x,a.pos.z)?WATER_Y:0;if(!pl.flying&&!tgt)a.pos.y=lerp(a.pos.y,gy,damp(6,dt));else a.pos.y=lerp(a.pos.y,Math.max(gy,goal.y-0.5),damp(2,dt));
  const hs=Math.hypot(a.vel.x,a.vel.z);const lookX=tgt?tgt.pos.x-a.pos.x:(hs>1?a.vel.x:pl.pos.x-a.pos.x),lookZ=tgt?tgt.pos.z-a.pos.z:(hs>1?a.vel.z:pl.pos.z-a.pos.z);a.face=turnAngle(a.face,Math.atan2(lookX,lookZ),damp(7,dt));a.g.position.copy(a.pos);a.g.rotation.y=a.face;
  // attack
  a.atkT-=dt;if(tgt&&dist<tgt.r+5&&a.atkT<=0){a.atkT=rand(0.5,0.9);const hc=new V3(tgt.pos.x,tgt.pos.y+tgt.cy,tgt.pos.z);damageEnemy(tgt,55,new V3());sparks(hc,10,12);fxFlash(hc,0.4,2.5,0.14,'#8be0ff');a.punchW=1;sfxAt('punch',a.pos,200,0.5);}
  if(tgt&&dist>tgt.r+6&&dist<140){a.beamT-=dt;if(a.beamT<=0){a.beamT=rand(0.8,1.4);const o=a.N.fists[0].getWorldPosition(new V3()),hc=new V3(tgt.pos.x,tgt.pos.y+tgt.cy,tgt.pos.z),d=hc.clone().sub(o),L=d.length();d.divideScalar(L||1);for(let k=0;k<10;k++)emit(glowPS,o.x+d.x*L*k/10,o.y+d.y*L*k/10,o.z+d.z*L*k/10,0,0,0,0.12,0.3,0.1,0.5,0.85,1,1,0,0);damageEnemy(tgt,22,new V3());sfxAt('zap',a.pos,200,0.4);}}
  // animation
  const N=a.N;a.ph+=Math.min(24,hs/1.3*Math.PI)*dt;const sv=HA.ph;HA.ph=a.ph;let p=pLoco(Math.min(2,hs/14),0,time);HA.ph=sv;
  if(pl.flying||a.pos.y>gy+1){p=pCruise();N.tilt.rotation.x=lerp(N.tilt.rotation.x,clamp(hs/40,0,1)*1.1,damp(4,dt));}else N.tilt.rotation.x=lerp(N.tilt.rotation.x,0,damp(6,dt));
  if(a.punchW>0){a.punchW=Math.max(0,a.punchW-dt*3);p.aR=lerp(p.aR,-2.9,a.punchW);p.eR=lerp(p.eR,-0.5,a.punchW);}
  N.hips.position.y=p.hy;N.spine.rotation.x=p.lean;N.head.rotation.x=p.hd;N.LLth.rotation.x=p.tL;N.LRth.rotation.x=p.tR;N.LLkn.rotation.x=p.kL;N.LRkn.rotation.x=p.kR;N.ALsh.rotation.x=p.aL;N.ARsh.rotation.x=p.aR;N.ALel.rotation.x=p.eL;N.ARel.rotation.x=p.eR;N.ALsh.rotation.z=p.zL;N.ARsh.rotation.z=-p.zR;}}

function trySize(){if(pl.dead||pl.cd.shock>0)return;pl.cd.shock=0.9;SIZE_T=SIZE_T===1?0.12:SIZE_T<1?2222:1;const c=pl.pos.clone();c.y+=1;
 fxFlash(c,0.5,SIZE_T>1?30:4,0.35,'#ffd27a');fxGroundRing(pl.pos,0.5,SIZE_T>1?40:4,0.8,'#ffd27a');if(SIZE_T>1)addShake(0.6);sfx(SIZE_T>1?'shock':'charge',0.8);
 if(SIZE_T>1){cityImpact(pl.pos,Math.max(22,SIZE_T*0.7),24);for(const b of solidsNear(pl.pos.x,pl.pos.z).slice())if(boxDist(pl.pos,b.col)<Math.max(9,SIZE_T*0.45))damageBuilding(b,900,closestOnBox(pl.pos,b.col),true);for(const e of enemies){if(!e.dead&&e.pos.distanceTo(pl.pos)<10){const k=e.pos.clone().sub(pl.pos).setY(0).normalize().multiplyScalar(25);k.y=12;damageEnemy(e,30,k);}}}
 toast(SIZE_T>1?'Dev boyut':SIZE_T<1?'Karınca boyu':'Normal boyut','');}
function tryBlink(){if(pl.dead||pl.cd.shock>0||pl.en<12)return;pl.cd.shock=1.1;pl.en-=12;const d=camFwd.clone();if(!pl.flying&&pl.grounded)d.y=Math.max(d.y,0)*0.4;d.normalize();
 const o=pl.pos.clone();o.y+=1;const r=raycastWorld(o,d,60,false);const dist=Math.max(3,Math.min(60,r.t-2));
 const smoke=p=>{for(let i=0;i<26;i++)emit(dustPS,p.x+rand(-0.6,0.6),p.y+rand(0,2),p.z+rand(-0.6,0.6),rand(-2,2),rand(0,2),rand(-2,2),rand(0.6,1.1),1,3.5,0.32,0.22,0.42,0.75,1.5,0.3);fxFlash(p.clone().setY(p.y+1),0.4,3,0.2,'#b07cff');};
 smoke(pl.pos.clone());pl.pos.addScaledVector(d,dist);pl.pos.y=Math.max(pl.pos.y,groundAt(pl.pos.x,pl.pos.y+2,pl.pos.z));smoke(pl.pos.clone());camPivot.set(pl.pos.x,pl.pos.y+1.6,pl.pos.z);sfx('whoosh',1);sfx('zap',0.5);}

/* female build for Zerre: narrower shoulders, slimmer arms and waist, wider hips, no bulky armour */
let heroArmor=null;
function collectArmor(){if(heroArmor)return heroArmor;const ex=new Set();for(const k in heroExtras)heroExtras[k].forEach(m=>ex.add(m));heroArmor=[];hero.traverse(o=>{if(o.isMesh&&(o.material===HM.armor||o.material===HM.star)&&!ex.has(o))heroArmor.push(o);});return heroArmor;}
const FEMALE_HEROES=new Set(['shrink']);const MAILLOT=new Set(['shrink']);
let limbSuitP=null,limbSuitV=new WeakMap();
function collectLimbSuit(root,sub){const out=[];for(const g of sub)g&&g.traverse(o=>{if(o.isMesh&&(o.material===HM.suit||(HM.suitT&&o.material===HM.suitT)))out.push(o);});return out;}
function applyMaillot(root,sub,on,civ,skin){if(civ)return;let list=limbSuitV.get(root);if(!list){list=collectLimbSuit(root,sub);limbSuitV.set(root,list);}for(const o of list)o.material=on?skin:HM.suit;}
function applyMaillotClone(root,sub,on,swap){if(!on)return;const vs=swap(HM.suit),vst=HM.suitT?swap(HM.suitT):null,sk=swap(HM.skin);for(const g of sub)g&&g.traverse(o=>{if(o.isMesh&&(o.material===vs||o.material===vst))o.material=sk;});}
function applyBodyMorph(N,female,civ){N.spine.scale.set(female?0.8:1,female?1.02:1,female?0.86:1);N.head.scale.set(female?1/0.8:1,female?1/1.02:1,female?1/0.86:1);N.hips.scale.set(female?1.22:1,female?0.98:1,female?1.14:1);for(const m of N.armor)m.visible=!female&&!civ;}
function updateHeroExtras(){for(const k in heroExtras)heroExtras[k].forEach(m=>m.visible=(k===HERO_ID)&&!civOn);applyBodyMorph({spine,head,hips,armor:collectArmor()},FEMALE_HEROES.has(HERO_ID),civOn);applyMaillot(hero,[AL.sh,AR.sh,LL.th,LR.th],MAILLOT.has(HERO_ID),civOn,HM.skin);}
let heroCostumes={};
function heroSlotLabels(){const rmbN={fire:'Alev püskürt',tk:'Telekinezi',chain:'Zincir şimşek',megabeam:'Kesici lazer',eyes:HERO_ID==='void'?'Kızıl ışın':'Isı lazeri',hands:'Plazma ışını',slow:'Zamanı durdur',ice:'Dondurucu ışın',scope:'Uzağı yakınlaştır'}[HERO.rmb],qN={shock:'Şok dalgası',quake:'Deprem',rockets:'Mikro füzeler',whirl:'Kasırga',blackhole:'Kara delik',firenova:'Ateş patlaması',push:'Zihin dalgası',thunder:'Yıldırım düşür',size:'Boyut değiştir',iceburst:'Buz patlaması',blink:'Işınlan',smash:'Yıkıcı darbe',clone:'Klon yarat'}[HERO.q];
 const s2=document.querySelector('.slot[data-i="2"]'),s3=document.querySelector('.slot[data-i="3"]');s2.style.display=rmbN?'':'none';if(rmbN)s2.querySelector('.n').textContent=rmbN;s3.querySelector('.n').textContent=qN;const us=$('ultSlot');if(us)us.style.display=HERO.ult?'':'none';const tg=document.querySelector('#touch .tb[data-k="KeyG"]');if(tg)tg.style.display=HERO.ult?'':'none';const tx2=document.querySelector('#touch .tb[data-k="KeyX"]');if(tx2)tx2.style.display=HERO_ID==='wind'?'':'none';for(const kk of['KeyB','KeyL']){const tb=document.querySelector('#touch .tb[data-k="'+kk+'"]');if(tb)tb.style.display=HERO_ID==='shrink'?'':'none';}for(const kk of['Digit1','Digit2','Digit3']){const tb=document.querySelector('#touch .tb[data-k="'+kk+'"]');if(tb)tb.style.display=HERO_ID==='twin'?'':'none';}
 const tR=document.querySelector('#touch .tb[data-m="R"]'),tQ=document.querySelector('#touch .tb[data-k="KeyQ"]'),tF=document.querySelector('#touch .tb[data-k="KeyF"]'),tC=document.querySelector('#touch .tb[data-k="KeyC"]');
 if(tR){tR.style.display=rmbN?'':'none';tR.textContent=rmbN||'';}if(tQ)tQ.textContent=qN;if(tF)tF.style.visibility=HERO.fly?'':'hidden';if(tC)tC.style.visibility=HERO.fly?'':'hidden';}
function applyHero(id,silent){if(!HEROES[id])id='guardian';if(HERO_ID!==id||!heroCostumes[HERO_ID])heroCostumes[HERO_ID]=Object.assign({},costume);HERO_ID=id;HERO=HEROES[id];
 Object.assign(costume,COS_DEF,HERO.look||{},heroCostumes[id]||{});applyCostume();syncCostumeUI();SIZE=SIZE_T=1;rig.scale.setScalar(1.04*HERO.scale);
 if(HERO_ID!=='twin'&&typeof clearAllies==='function')clearAllies();if(!HERO.fly&&pl.flying)stopFly();const oldMax=ST.maxHp;ST=stats();pl.hp=Math.min(ST.maxHp,pl.hp*ST.maxHp/oldMax);updateHeroExtras();heroSlotLabels();renderHeroes();saveDirty=true;if(typeof NET!=='undefined'&&NET.open)netSend({t:'hero',id:HERO_ID});if(!silent)toast(HERO.name,HERO.role);}
function renderHeroes(){const L=$('heroList');if(!L)return;L.innerHTML='';for(const id in HEROES){const h=HEROES[id],look=h.look||costume,card=document.createElement('div');card.className='hcard'+(id===HERO_ID?' on':'');
  const sw=document.createElement('div');sw.className='hsw';for(const k of['suit','acc','energy']){const i=document.createElement('i');i.style.background=(id===HERO_ID?costume:look)[k]||'#888';sw.appendChild(i);}
  const t=document.createElement('h3');t.textContent=h.name;const r=document.createElement('div');r.className='hrole';r.textContent=h.role;const d=document.createElement('p');d.textContent=h.desc;
  const st=document.createElement('div');st.className='hstats';for(const [lbl,v] of[['Güç',h.pow],['Hız',h.spd],['Uçuş',h.flyS]]){const row=document.createElement('div');const sp=document.createElement('span');sp.textContent=lbl;const pips=document.createElement('div');pips.className='pips';for(let k=0;k<5;k++){const q=document.createElement('i');if(k<v)q.className='on';pips.appendChild(q);}row.append(sp,pips);st.appendChild(row);}
  const b=document.createElement('button');b.className=id===HERO_ID?'btn alt':'btn';b.textContent=id===HERO_ID?'Seçili':'Oyna';b.onclick=()=>applyHero(id);const nV=VILS.filter(v=>v.id===id).length,isV=nV>0;const bv=document.createElement('button');bv.className='btn alt vbtn'+(isV?' on':'');bv.textContent=isV?'Kötü ×'+nV+' · ekle':'Kötü yap';if(VILS.length>=VIL_MAX){bv.disabled=true;bv.style.opacity='.45';}bv.onclick=()=>addVillain(id);const bm=document.createElement('button');bm.className='btn alt vbtn on';bm.textContent='−';bm.title='Bir tanesini kaldır';bm.style.display=isV?'':'none';bm.onclick=()=>removeVillain(id);const br=document.createElement('div');br.className='hbtns';br.append(b,bv,bm);if(isV)card.classList.add('vil');card.append(sw,t,r,d,st,br);L.appendChild(card);}
 const vr=$('vilRow');if(vr){vr.innerHTML='';const tx=document.createElement('p');tx.textContent=VILS.length?'Şehre saldıran kötüler ('+VILS.length+'/'+VIL_MAX+'): '+VILS.map(v=>v.label).join(', '):'Aynı anda 30 kötüye kadar seçebilirsin: farklı kahramanlar ya da aynı kahramandan birkaç tane. Yapay zekâ hepsini yönetir ve hepsi aynı anda şehre saldırır.';vr.appendChild(tx);if(VILS.length){const x=document.createElement('button');x.className='btn alt';x.textContent='Kötüleri kaldır';x.onclick=clearVillains;vr.appendChild(x);}const vs=document.createElement('button');vs.className='btn alt'+(VERSUS?' vbtn on':'');vs.textContent=VERSUS?'Kötüler birbiriyle savaşıyor: Açık':'Kötüleri birbiriyle dövüştür';vs.onclick=toggleVersus;vr.appendChild(vs);const ar=document.createElement('div');ar.className='aggwrap';const al=document.createElement('span');al.textContent='Saldırganlık:';const ab=document.createElement('div');ab.className='todrow';ab.id='aggRow2';aggButtons(ab);ar.append(al,ab);vr.appendChild(ar);}}
let heroFrom='menu';
function openHeroes(from){heroFrom=from;state='heroes';clearInput();if(document.pointerLockElement)document.exitPointerLock();hideAll();$('touch').classList.add('hidden');$('hud').classList.add('hidden');renderHeroes();$('heroes').classList.remove('hidden');}
function closeHeroes(){$('heroes').classList.add('hidden');saveNow();if(heroFrom==='pause'){state='pause';$('hud').classList.remove('hidden');$('pause').classList.remove('hidden');}else{state='menu';$('menu').classList.remove('hidden');}}
let mapFrom='menu';
function renderMaps(){const L=$('mapList');if(!L)return;L.innerHTML='';for(const [id,name,desc] of[['city','Şehir','20.000 insanın yaşadığı, gökdelenleri, nehri, trafiği ve polisiyle canlı bir şehir. Yıkabileceğin her şey burada.'],['arena','Boş arazi','Uçsuz bucaksız, çimenli bir düzlük; arada kayalar, ağaç kümeleri ve uzakta tepeler. Ne bina var ne insan: kötülerle ya da kötüleri birbiriyle rahatça dövüştürmek için.']]){
 const c=document.createElement('div');c.className='hcard'+(MAP===id?' on':'');const t=document.createElement('h3');t.textContent=name;const d=document.createElement('p');d.textContent=desc;const b=document.createElement('button');b.className=MAP===id?'btn alt':'btn';b.textContent=MAP===id?'Seçili':'Seç';b.onclick=()=>setMap(id);c.append(t,d,b);L.appendChild(c);}}
function openMaps(from){mapFrom=from;hideAll();renderMaps();$('maps').classList.remove('hidden');}
function closeMaps(){$('maps').classList.add('hidden');saveNow();if(mapFrom==='pause'){$('pause').classList.remove('hidden');}else $('menu').classList.remove('hidden');}
/* ---------- experimental online co-op / PvP via PeerJS (P2P) ---------- */
const NET={peer:null,conn:null,open:false,host:false,code:'',pvp:false,remote:null,sendT:0,role:'',hitT:0};
function netStatus(t){const el=$('netStatus');if(el)el.textContent=t;}
function netCode(){let c='';for(let i=0;i<4;i++)c+='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)];return c;}
function netReset(){netClearTimer();try{if(NET.conn)NET.conn.close();if(NET.peer)NET.peer.destroy();}catch(e){}NET.peer=null;NET.conn=null;NET.open=false;if(NET.remote){scene.remove(NET.remote.g);NET.remote=null;}}
const NET_ICE={config:{iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']},{urls:'stun:global.stun.twilio.com:3478'},{urls:['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp'],username:'openrelayproject',credential:'openrelayproject'}]},debug:1};
let netTimer=0;
function netClearTimer(){if(netTimer){clearTimeout(netTimer);netTimer=0;}}
function netNoLib(){netStatus('Bağlantı kütüphanesi yüklenemedi. İnternet bağlantını kontrol et; Claude önizlemesi yerine indirdiğin HTML dosyasını Chrome ile aç.');}
function netHost(tries){tries=tries|0;if(typeof Peer==='undefined'){netNoLib();return;}netReset();NET.host=true;NET.code=netCode();netStatus('Oda kuruluyor…');$('netCodeBig').textContent='';
 const peer=new Peer('gokm-'+NET.code,NET_ICE);NET.peer=peer;
 peer.on('open',()=>{netStatus('Oda hazır. Kod: '+NET.code+' — arkadaşın bu kodu yazıp Katıl desin. Bu sayfayı kapatma, bekleniyor…');$('netCodeBig').textContent=NET.code;});
 peer.on('connection',c=>{if(NET.conn&&NET.open){try{c.close();}catch(e){}return;}NET.conn=c;netStatus('Arkadaşın bağlanıyor…');netBind();});
 peer.on('disconnected',()=>{if(NET.peer===peer&&!peer.destroyed){try{peer.reconnect();}catch(e){}}});
 peer.on('error',e=>{const t=e&&e.type||String(e);if(t==='unavailable-id'&&tries<4){netHost(tries+1);return;}netStatus(t==='network'||t==='server-error'||t==='socket-error'?'Bağlantı sunucusuna ulaşılamadı. İnternetini kontrol et ya da biraz sonra tekrar dene.':'Hata: '+t+' — tekrar Oda Kur de.');});}
function netJoin(){if(typeof Peer==='undefined'){netNoLib();return;}const code=($('netJoinInput').value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');$('netJoinInput').value=code;if(code.length!==4){netStatus('Kod 4 karakter olmalı (örnek: K7XM).');return;}netReset();NET.host=false;NET.code=code;netStatus('Odaya bağlanılıyor…');
 const peer=new Peer(NET_ICE);NET.peer=peer;
 peer.on('open',()=>{const c=peer.connect('gokm-'+code,{reliable:true,serialization:'json'});NET.conn=c;netBind();
  netClearTimer();netTimer=setTimeout(()=>{if(!NET.open)netStatus('Bağlantı kurulamadı (zaman aşımı). Oda kuranın sayfası açık mı? İkiniz de aynı sürümü kullanın; olmazsa farklı bir ağ (ör. telefon interneti) dene.');},20000);});
 peer.on('disconnected',()=>{if(NET.peer===peer&&!peer.destroyed&&!NET.open){try{peer.reconnect();}catch(e){}}});
 peer.on('error',e=>{const t=e&&e.type||String(e);netClearTimer();netStatus(t==='peer-unavailable'?'Oda bulunamadı: kodu kontrol et. Oda kuranın sayfası açık kalmalı.':t==='network'||t==='server-error'||t==='socket-error'?'Bağlantı sunucusuna ulaşılamadı. İnternetini kontrol et.':'Hata: '+t+' — tekrar dene.');});}
function netBind(){const c=NET.conn;const onOpen=()=>{if(NET.open)return;NET.open=true;netClearTimer();netStatus('Bağlandı! "Oyuna başla"ya bas. Arkadaşın mavi hâleyle görünür.');try{c.send({t:'hero',id:HERO_ID});c.send({t:'pvp',on:NET.pvp});}catch(e){}};
 c.on('open',onOpen);if(c.open)onOpen();
 c.on('data',d=>{try{netData(d);}catch(e){console.error(e);}});c.on('close',()=>{NET.open=false;netStatus('Bağlantı kesildi.');if(NET.remote){scene.remove(NET.remote.g);NET.remote=null;}});
 c.on('error',()=>{netStatus('Bağlantı hatası.');});}
function netSend(o){if(NET.conn&&NET.open){try{NET.conn.send(o);}catch(e){}}}
function netSetHero(id){if(NET.remote&&NET.remote.id===id)return;if(NET.remote)scene.remove(NET.remote.g);const mdl=buildVillainModel(HEROES[id]?id:'guardian');mdl.root.traverse(o=>{if(o.isMesh)o.castShadow=false;});
 const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:ringTex,color:0x4aa3ff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));halo.scale.setScalar(4);halo.position.y=2.4;mdl.root.add(halo);
 scene.add(mdl.root);NET.remote={id,g:mdl.root,N:mdl.nodes,pos:pl.pos.clone(),tp:pl.pos.clone(),face:0,hs:0,fly:false,ph:0,hp:100,atk:0};}
function netData(d){if(!d)return;if(d.t==='hero'){netSetHero(d.id);}
 else if(d.t==='pvp'){NET.pvp=d.on;const cb=$('netPvp');if(cb)cb.checked=d.on;}
 else if(d.t==='s'){if(!NET.remote)netSetHero(d.id||'guardian');const r=NET.remote;if(r){r.tp.set(d.x,d.y,d.z);r.face=d.f;r.hs=d.hs;r.fly=d.fly;r.hp=d.hp;r.atk=d.atk;}}
 else if(d.t==='hit'){if(typeof hurt==='function'&&!pl.dead)hurt(d.dmg);}}
function netTick(dt){if(!NET.open)return;NET.sendT-=dt;
 if(NET.sendT<=0){NET.sendT=0.06;const hs=Math.hypot(pl.vel.x,pl.vel.z);let atk=0;if(time-pl.punchT<0.2)atk=1;else if(pl.laser)atk=2;netSend({t:'s',id:HERO_ID,x:pl.pos.x,y:pl.pos.y,z:pl.pos.z,f:pl.facing,hs,fly:pl.flying,hp:Math.round(pl.hp),atk});}
 const r=NET.remote;if(!r)return;r.pos.lerp(r.tp,Math.min(1,dt*12));const N=r.N;r.g.position.copy(r.pos);r.g.rotation.y=r.face;
 r.ph+=Math.min(24,r.hs/1.3*Math.PI)*dt;const sv=HA.ph;HA.ph=r.ph;let p=pLoco(Math.min(2,r.hs/14),0,time);HA.ph=sv;
 if(r.fly){p=pCruise();N.tilt.rotation.x=lerp(N.tilt.rotation.x,0.8,damp(4,dt));}else N.tilt.rotation.x=lerp(N.tilt.rotation.x,0,damp(6,dt));
 if(r.atk===1){p.aR=-2.6;p.eR=-0.4;}else if(r.atk===2){p.aR=p.aL=-1.4;}
 N.hips.position.y=p.hy;N.spine.rotation.x=p.lean;N.head.rotation.x=p.hd;N.LLth.rotation.x=p.tL;N.LRth.rotation.x=p.tR;N.LLkn.rotation.x=p.kL;N.LRkn.rotation.x=p.kR;N.ALsh.rotation.x=p.aL;N.ARsh.rotation.x=p.aR;N.ALel.rotation.x=p.eL;N.ARel.rotation.x=p.eR;N.ALsh.rotation.z=p.zL;N.ARsh.rotation.z=-p.zR;
 // PvP: my attacks damage the remote (victim-authoritative on their side via 'hit')
 if(NET.pvp&&!pl.dead){const d=Math.hypot(r.pos.x-pl.pos.x,r.pos.z-pl.pos.z),dy=Math.abs(r.pos.y-pl.pos.y);NET.hitT-=dt;
  if(NET.hitT<=0){if(time-pl.punchT<0.2&&d<4.5&&dy<4){netSend({t:'hit',dmg:40});NET.hitT=0.4;}
   else if(pl.laser&&d<140){const f=new V3(Math.sin(pl.facing),0,Math.cos(pl.facing)),to=new V3(r.pos.x-pl.pos.x,0,r.pos.z-pl.pos.z);if(to.lengthSq()>1&&to.normalize().dot(f)>0.9){netSend({t:'hit',dmg:8});NET.hitT=0.12;}}}}}

function openNet(){hideAll();$('net').classList.remove('hidden');netStatus(typeof Peer==='undefined'?'Bağlantı kütüphanesi yüklenemedi. Çok oyunculu çalışmıyor.':'Oda kur ya da bir koda katıl.');}
function closeNet(){$('net').classList.add('hidden');$('menu').classList.remove('hidden');}
function openSettings(){hideAll();$('settings').classList.remove('hidden');qualButtons($('qualRowSet'));const qn=$('qualNote');if(qn)qn.textContent=['En akıcı, en sade: düşük çözünürlük, az insan, gölgesiz.','Akıcı: düşük çözünürlük, orta kalabalık.','Dengeli: normal çözünürlük, gölgeler açık.','En güzel ama en ağır: tam çözünürlük, kalabalık, gölge ve efektler.'][QUAL];const pc=$('postOnSet');if(pc)pc.checked=POST.enabled;}
function closeSettings(){$('settings').classList.add('hidden');$('menu').classList.remove('hidden');}
$('menuSettings').onclick=openSettings;$('settingsClose').onclick=closeSettings;
if($('postOnSet'))$('postOnSet').onchange=e=>{POST_PREF=e.target.checked;if(typeof setPost==='function')setPost(POST_PREF);saveDirty=true;};
$('menuNet').onclick=openNet;$('netClose').onclick=closeNet;$('netJoinBtn').onclick=netJoin;$('netHostBtn').onclick=()=>netHost(0);$('netJoinInput').addEventListener('keydown',e=>{if(e.key==='Enter')netJoin();});$('netPlay').onclick=()=>{$('net').classList.add('hidden');startGame();};$('netPvp').onchange=e=>{NET.pvp=e.target.checked;netSend({t:'pvp',on:NET.pvp});};
$('menuMap').onclick=()=>openMaps('menu');$('pauseMap').onclick=()=>openMaps('pause');$('mapClose').onclick=closeMaps;

$('menuHeroes').onclick=()=>openHeroes('menu');$('pauseHeroes').onclick=()=>openHeroes('pause');$('heroClose').onclick=closeHeroes;
/* hero-specific Q abilities */
function windBooms(){if(HERO_ID!=='wind'||civOn||pl.dead||pl.flying){pl.wLvl=0;return;}const kmh=Math.hypot(pl.vel.x,pl.vel.z)*3.6,lvl=Math.floor(kmh/500);
 if(lvl>(pl.wLvl||0)){pl.wLvl=lvl;const d=new V3(pl.vel.x,0,pl.vel.z).normalize(),c=pl.pos.clone().addScaledVector(d,-3);c.y+=1;
  ringFx(c,d,8+lvl*2.5,0.6,0xffffff);ringFx(c.clone().addScaledVector(d,-4),d,5+lvl*1.5,0.45,0xcfe9ff);fxFlash(c,1,6+lvl,0.18,'#ffffff');
  for(let i=0;i<30;i++){const a=rand(0,6.283),r=rand(0.5,3+lvl*0.6);emit(dustPS,c.x+Math.cos(a)*r*(1-Math.abs(d.x)),c.y+Math.sin(a)*r*0.6,c.z+Math.cos(a)*r*(1-Math.abs(d.z)),-d.x*rand(4,14)+rand(-3,3),rand(-1,3),-d.z*rand(4,14)+rand(-3,3),rand(0.8,1.4),1.2,4,0.86,0.88,0.9,0.5,1,0);}
  sfx('sonic',1);addShake(0.25+lvl*0.04);cityImpact(c.clone().setY(0),8+lvl*1.5,12+lvl*2);if(lvl%2===0)toast((lvl*500).toLocaleString('tr-TR')+' km/sa','Ses patlaması');}
 else if(kmh<(pl.wLvl||0)*500-150)pl.wLvl=Math.max(0,Math.floor((kmh+150)/500));}
let phaseMats=null,phaseHumT=0;
function setPhaseLook(on){if(!phaseMats){const set=new Set();hero.traverse(o=>{if(o.isMesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>set.add(m));});phaseMats=[...set].map(m=>({m,t:m.transparent,o:m.opacity}));}
 for(const q of phaseMats){q.m.transparent=on?true:q.t;q.m.opacity=on?Math.min(q.o,0.5):q.o;}}
function updatePhase(dt){const hs=Math.hypot(pl.vel.x,pl.vel.z);const want=HERO_ID==='wind'&&!civOn&&!pl.dead&&state==='play'&&PHASE_MAN;
 if(want!==PHASE_ON){PHASE_ON=want;setPhaseLook(want);if(want)sfx('charge',0.5);}
 if(PHASE_ON){rig.position.x=rand(-0.05,0.05);rig.position.z=rand(-0.05,0.05);if(PHASE_MAN)pl.en=Math.max(0,pl.en-4*dt);if(PHASE_MAN&&pl.en<=0){PHASE_MAN=false;toast('Titreşim bitti','Enerji tükendi');}
  if(Math.random()<0.7){const ec=HM.energy.emissive;emit(glowPS,pl.pos.x+rand(-0.35,0.35),pl.pos.y+rand(0.2,1.8)*HERO.scale,pl.pos.z+rand(-0.35,0.35),rand(-0.5,0.5),rand(-0.5,0.5),rand(-0.5,0.5),0.18,0.25,0.05,ec.r,ec.g,ec.b,0.8,0,0);}
  phaseHumT-=dt;if(phaseHumT<=0){phaseHumT=0.22;if(AC)sfx('cricket',0.3,0,6000,0.05);}}
 else{rig.position.x=0;rig.position.z=0;}}
function phaseDodge(){const c=pl.pos.clone();c.y+=1.2;fxFlash(c,0.4,2.2,0.15,'#cfefff');if(Math.random()<0.3)sfx('whoosh',0.3);}
function toggleRest(m){if(HERO_ID!=='shrink'||civOn||pl.dead||pl.flying||SIZE>1.5){return;}HA.restMode=HA.restMode===m?0:m;HA.restT=HA.restMode?99:0;toast(HA.restMode===1?'Oturuyor':HA.restMode===2?'Uzanıyor':'Kalkıyor','');}
function togglePhase(){if(HERO_ID!=='wind'||civOn||pl.dead)return;PHASE_MAN=!PHASE_MAN;toast(PHASE_MAN?'Titreşim açık':'Titreşim kapalı',PHASE_MAN?'Duvarlardan geçersin, hasar almazsın':'');}
/* ---------- grab & throw cars (Z), photo mode (O), day/night (N), weather (H), statistics ---------- */
function holdPoint(){const S=HERO.scale*SIZE;return new V3(pl.pos.x+Math.sin(pl.facing)*0.25*S,pl.pos.y+2.85*S,pl.pos.z+Math.cos(pl.facing)*0.25*S);}
function tryGrab(){if(pl.dead||civOn)return;if(ARENA&&!HELD){toast('Arazide araba yok','');return;}if(HELD){const c=HELD;HELD=null;c.state=0;const f=camFwd.clone();launchCar(c,f.multiplyScalar(95).add(new V3(0,5,0)));pl.facing=Math.atan2(camFwd.x,camFwd.z);pl.punchT=time;pl.combo=0;sfx('whoosh',1);sfx('punch',0.5);addShake(0.2);return;}
 const S=Math.max(1,HERO.scale*SIZE);let best=null,bd=7*S;for(const c of cars){if(c.state!==0)continue;const d=Math.hypot(c.pos.x-pl.pos.x,c.pos.z-pl.pos.z);if(d<bd&&Math.abs(c.pos.y-pl.pos.y)<4*S){bd=d;best=c;}}
 if(!best){toast('Yakında araba yok','Bir arabanın yanına git');return;}best.state=3;HELD=best;sfx('land',0.5);dustBurst(best.pos,8,3,1,1.5,3,0.8);}
function togglePhoto(){PHOTO=!PHOTO;$('hud').style.visibility=PHOTO?'hidden':'';if(PHOTO){photoZoom=1;toast('Fotoğraf modu','Fareyle çevir, tekerlekle yaklaş/uzaklaş, O ile çık');}}
addEventListener('wheel',e=>{if(PHOTO)photoZoom=clamp(photoZoom*(e.deltaY>0?1.12:0.89),0.25,8);},{passive:true});
const TOD_PRESETS=[[0.3,'Sabah'],[0.5,'Öğle'],[0.66,'Akşamüstü'],[0.735,'Gün batımı'],[0,'Gece']];
function cycleTOD(){let k=0,bd=9;TOD_PRESETS.forEach((p,i)=>{const d=Math.min(Math.abs(p[0]-TOD.t),1-Math.abs(p[0]-TOD.t));if(d<bd){bd=d;k=i;}});const n=TOD_PRESETS[(k+1)%TOD_PRESETS.length];setTOD(n[0],false);toast(n[1],'');}
function trackStats(dt){const st=prog.st||(prog.st={dist:0,maxK:0,maxAlt:0,craters:0,vill:0,time:0});st.time+=dt;if(pl.dead)return;const v=pl.vel.length();st.dist+=v*dt;st.maxK=Math.max(st.maxK,v*3.6);st.maxAlt=Math.max(st.maxAlt,realAlt);}
function renderStats(){const st=prog.st||{dist:0,maxK:0,maxAlt:0,craters:0,vill:0,time:0},box=$('statsBox');if(!box)return;const f=n=>Math.round(n).toLocaleString('tr-TR');const h=Math.floor(st.time/3600),mi=Math.floor(st.time/60)%60;
 const rows=[['Oynama süresi',(h?h+' sa ':'')+mi+' dk'],['Kat edilen mesafe',(st.dist/1000).toLocaleString('tr-TR',{maximumFractionDigits:1})+' km'],['En yüksek hız',f(st.maxK)+' km/sa'],['En yüksek irtifa',st.maxAlt>1000?f(st.maxAlt/1000)+' km':f(st.maxAlt)+' m'],['Yıkılan bina',f(prog.destroyed||0)],['Öldürülen insan',f(prog.kills||0)],['Açılan krater',f(st.craters)],['Yenilen kötü',f(st.vill)]];
 box.innerHTML='<div class="stlbl">İstatistikler</div>';const g=document.createElement('div');g.className='stgrid';for(const [a,b] of rows){const d=document.createElement('div');const s1=document.createElement('span');s1.textContent=a;const s2=document.createElement('b');s2.textContent=b;d.append(s1,s2);g.appendChild(d);}box.appendChild(g);}
document.querySelectorAll('.wx').forEach(b=>b.addEventListener('click',()=>setWeather(+b.dataset.w)));
let frAcc=0,frN=0,curPR=DPR,lastPRChange=0;let POST_PREF=true;function applyQuality(){const Q=QUAL_LV[clamp(QUAL,0,3)];QCAP=Math.min(DPR,Q.pr);curPR=QCAP;renderer.setPixelRatio(QCAP);resize();PED_CAP=Q.peds;CROWD_ON=Q.crowd;sun.castShadow=Q.shadow;if(typeof setPost==='function'&&POST.ok)setPost(Q.post&&POST_PREF);for(let i=Math.min(PN,PED_CAP);i<PN;i++)if(typeof hidePed==='function')hidePed(i);}
function qualButtons(box){if(!box)return;box.innerHTML='';QUAL_LV.forEach((L,i)=>{const b=document.createElement('button');b.type='button';b.className='agg'+(i===QUAL?' on':'');b.textContent=L.n;b.onclick=()=>setQual(i);box.appendChild(b);});}
function setQual(i){QUAL=clamp(i|0,0,3);applyQuality();qualButtons($('qualRow'));qualButtons($('qualRowSet'));const qn=$('qualNote');if(qn)qn.textContent=['En akıcı, en sade: düşük çözünürlük, az insan, gölgesiz.','Akıcı: düşük çözünürlük, orta kalabalık.','Dengeli: normal çözünürlük, gölgeler açık.','En güzel ama en ağır: tam çözünürlük, kalabalık, gölge ve efektler.'][QUAL];const pc=$('postOnSet');if(pc)pc.checked=POST.enabled;saveDirty=true;toast('Grafik: '+QUAL_LV[QUAL].n,['En akıcı, en sade','Akıcı','Dengeli','En güzel, en ağır'][QUAL]);}
function aggButtons(box){if(!box)return;box.innerHTML='';AGG_LV.forEach((L,i)=>{const b=document.createElement('button');b.type='button';b.className='agg'+(i===AGG?' on':'');b.textContent=L.n;b.onclick=()=>setAgg(i);box.appendChild(b);});}
function setAgg(i){AGG=clamp(i|0,0,AGG_LV.length-1);saveDirty=true;aggButtons($('aggRow'));aggButtons($('aggRow2'));toast('Saldırganlık: '+AG().n,['Kötüler ara sıra saldırır','Dengeli saldırılar','Sık saldırı ve yıkım','Durmadan saldırır, her şeyi yakıp yıkar','Şehir dakikalar içinde yerle bir olur','Hiçbir şey ayakta kalmaz'][AGG]);}
aggButtons($('aggRow'));qualButtons($('qualRow'));

function heroQ(){if(HERO.q==='clone')return spawnAlly();if(HERO.q==='smash')return tryBruteSmash();if(HERO.q==='firenova'){SHOCK_R=24;SHOCK_MUL=1.4;return tryShock();}if(HERO.q==='push')return tryPush();if(HERO.q==='thunder')return tryThunder();if(HERO.q==='blackhole')return tryBlackHole();if(HERO.q==='size')return trySize();if(HERO.q==='iceburst')return tryIceBurst();if(HERO.q==='blink')return tryBlink();if(HERO.q==='shock'){SHOCK_R=18;SHOCK_MUL=1;tryShock();}else if(HERO.q==='quake'){SHOCK_R=30;SHOCK_MUL=1.8;tryShock();}else if(HERO.q==='whirl')tryWhirl();else if(HERO.q==='rockets')tryRockets();}
function tryWhirl(){if(pl.dead||pl.cd.shock>0||pl.en<30)return;pl.cd.shock=5;pl.en-=30;pl.shockT=time;const c=pl.pos.clone();c.y+=1;const R=26;
 for(let i=0;i<70;i++){const a=rand(0,6.283),r=rand(2,R);emit(dustPS,pl.pos.x+Math.cos(a)*r,rand(0.5,6),pl.pos.z+Math.sin(a)*r,-Math.sin(a)*14-Math.cos(a)*4,rand(2,8),Math.cos(a)*14-Math.sin(a)*4,rand(1,1.8),1.5,5,0.85,0.88,0.9,0.55,0.6,0.5);}
 fxGroundRing(pl.pos,R,1,0.6,'#cfefff');fxDome(c,R*0.6,1,0.5,new THREE.Color(0.8,0.95,1));
 for(const e of enemies){if(e.dead)continue;const dv=e.pos.clone().sub(pl.pos);const d=dv.length();if(d<R+e.r){const k=dv.setY(0).normalize().multiplyScalar(-10);k.y=26;damageEnemy(e,45*ST.dmg,k);}}
 for(const car of cars){if(car.state!==0)continue;const dx=car.pos.x-pl.pos.x,dz=car.pos.z-pl.pos.z,d=Math.hypot(dx,dz);if(d<R)launchCar(car,new V3(-dz/d*12-dx/d*6,22,dx/d*12-dz/d*6));}
 for(const p of peds){if(p.down>0)continue;const dx=p.x-pl.pos.x,dz=p.z-pl.pos.z,d=Math.hypot(dx,dz);if(d<R*0.8)knockPed(p,new V3(-dz/(d||1),0,dx/(d||1)),10);}
 addShake(0.35);sfx('whoosh',1);sfx('shock',0.6);}
const rocketMat=glowMat(0xffb060);
function tryRockets(){if(pl.dead||pl.cd.shock>0||pl.en<30)return;pl.cd.shock=4;pl.en-=30;pl.shockT=time;
 const tg=enemies.filter(e=>!e.dead&&e.pos.distanceTo(pl.pos)<180).sort((a,b)=>a.pos.distanceTo(pl.pos)-b.pos.distanceTo(pl.pos)).slice(0,8);
 for(let i=0;i<8;i++){const s=i%2?1:-1,from=pl.pos.clone().add(new V3(Math.cos(pl.facing)*s*0.35,1.7*HERO.scale,-Math.sin(pl.facing)*s*0.35));const tgt=tg.length?tg[i%tg.length]:null;
  const p=spawnProj({kind:'rocket',pos:from,vel:new V3(rand(-6,6),rand(10,16),rand(-6,6)).addScaledVector(camFwd,20),size:0.28,mat:rocketMat,life:6,dmg:55*ST.dmg,owner:0});
  if(p){p.target=tgt;p.tpt=aim.point.clone().add(new V3(rand(-6,6),rand(-2,4),rand(-6,6)));p.speed=95;p.delay=i*0.06;}}sfx('enemyShot',1);sfx('whoosh',0.8);}

$('menuShop').onclick=()=>openShop('menu');$('pauseShop').onclick=()=>openShop('pause');$('shopClose').onclick=closeShop;

function toggleCivilian(){if(pl.dead)return;const on=!civOn;if(on&&pl.flying)stopFly();setCivilian(on);const c=pl.pos.clone();c.y+=1;ringFx(c,UP,3.5,0.45,on?0xffffff:0xe8b923);sparks(c,40,6,on?[1,1,1]:[1,0.85,0.35]);flashAt(c,3);sfx(on?'ring':'shock',0.5);toast(on?'Sivil kılık':'Kahraman kılığı',on?'Güçlerin gizli. Tekrar T ile dönüş.':'Güçlerin geri döndü');if($('cc_civOn'))$('cc_civOn').checked=on;}
const SPECIAL=[['Altın Zırh',{suit:'#b8892a',acc:'#f2d27a',cape:'#5a1a1a',mask:'#2a1d0a',hair:'#1b1410',capeOn:true,maskOn:true},'cos_altin'],['Kara Şimşek',{suit:'#111318',acc:'#ffd21f',cape:'#111318',mask:'#111318',hair:'#0f0f12',capeOn:false,maskOn:true},'cos_simsek'],['Kızıl Yıldız',{suit:'#7a0f18',acc:'#d9dde3',cape:'#1a2a5a',mask:'#7a0f18',hair:'#3a2616',capeOn:true,maskOn:true},'cos_yildiz']];
let activePresets=[];const presetBox=$('presets');
function renderPresets(){presetBox.innerHTML='';activePresets=PRESETS.concat(SPECIAL.filter(q=>owned.includes(q[2])).map(q=>[q[0],q[1]]));activePresets.forEach(([name,c],i)=>{const b=document.createElement('button');b.className='pre';b.type='button';const sw=document.createElement('span');sw.className='sw';for(const k of['suit','acc','cape']){const it=document.createElement('i');it.style.background=c[k];sw.appendChild(it);}const t=document.createElement('span');t.textContent=name;b.append(sw,t);b.onclick=()=>{Object.assign(costume,c);applyCostume();syncCostumeUI();saveDirty=true;};presetBox.appendChild(b);});}
renderPresets();
function syncCostumeUI(){for(const k of['suit','acc','cape','mask','hair','energy','civShirt','civPants','civShoe'])$('cc_'+k).value=costume[k];$('cc_capeOn').checked=costume.capeOn;$('cc_maskOn').checked=costume.maskOn;
 [...presetBox.children].forEach((b,i)=>{const c=activePresets[i][1];b.classList.toggle('on',Object.keys(c).every(k=>String(c[k]).toLowerCase()===String(costume[k]).toLowerCase()));});}
for(const k of['suit','acc','cape','mask','hair','energy','civShirt','civPants','civShoe'])$('cc_'+k).addEventListener('input',e=>{costume[k]=e.target.value;applyCostume();syncCostumeUI();saveDirty=true;});
for(const k of['capeOn','maskOn'])$('cc_'+k).addEventListener('change',e=>{costume[k]=e.target.checked;applyCostume();syncCostumeUI();saveDirty=true;});
function openCostume(from){$('touch').classList.add('hidden');cosFrom=from;state='costume';clearInput();if(document.pointerLockElement)document.exitPointerLock();hideAll();$('hud').classList.add('hidden');$('costume').classList.remove('hidden');syncCostumeUI();}
function closeCostume(){$('costume').classList.add('hidden');saveNow();if(cosFrom==='pause'){state='pause';$('hud').classList.remove('hidden');$('pause').classList.remove('hidden');}else if(cosFrom==='play'){resume();}else{state='menu';$('menu').classList.remove('hidden');}}
$('cc_civOn').addEventListener('change',e=>{if(e.target.checked!==civOn)setCivilian(e.target.checked);});
$('menuCos').onclick=()=>openCostume('menu');$('pauseCos').onclick=()=>openCostume('pause');$('cosClose').onclick=closeCostume;
const smoothT=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const TK={day:{top:0x2c63b0,hor:0xcfdde9,gnd:0x6a6e74,sun:0xfff0da,hs:0xc4d8f2,hg:0x8a7a66,fog:0xcfdde9,cloud:0xffffff,si:3.1,hi:1.05,ai:0.18,exp:1.15},
 gold:{top:0x3d609c,hor:0xf0b07c,gnd:0x5e5048,sun:0xffae66,hs:0xcfa596,hg:0x7a5a44,fog:0xdfaa86,cloud:0xffc59c,si:2.5,hi:0.72,ai:0.14,exp:1.15},
 night:{top:0x03060e,hor:0x18223a,gnd:0x08090c,sun:0xa9bce8,hs:0x2e4068,hg:0x16120e,fog:0x111827,cloud:0x27303f,si:0.5,hi:0.32,ai:0.1,exp:1.45}};
let todEnvT=0,todVal=-1;
function applyTOD(regen){const th=(TOD.t-0.25)*Math.PI*2,sd=new V3(Math.cos(th),Math.sin(th)*0.9,0.35).normalize(),el=sd.y,fd=smoothT(0.1,0.6,el),fn=1-smoothT(-0.18,0.03,el);
 const col=k=>new THREE.Color(TK.gold[k]).lerp(new THREE.Color(TK.day[k]),fd).lerp(new THREE.Color(TK.night[k]),fn),num=k=>lerp(lerp(TK.gold[k],TK.day[k],fd),TK.night[k],fn);
 SUN_DIR.copy(sd);for(const m of[sky.material,envSky.material]){m.uniforms.top.value.copy(col('top'));m.uniforms.hor.value.copy(col('hor'));m.uniforms.gnd.value.copy(col('gnd'));m.uniforms.night.value=fn;}
 const ld=el>-0.04?sd:sd.clone().negate();SUN_OFF.copy(ld).multiplyScalar(240);sun.color.copy(col('sun')).convertSRGBToLinear();sun.intensity=num('si');
 HEMI.color.copy(col('hs')).convertSRGBToLinear();HEMI.groundColor.copy(col('hg')).convertSRGBToLinear();HEMI.intensity=num('hi');HEMI_BASE=HEMI.intensity;AMB.intensity=num('ai');
 scene.fog.color.copy(col('fog')).convertSRGBToLinear();FOG_BASE.copy(scene.fog.color);renderer.toneMappingExposure=num('exp');NIGHT_U.value=fn;
 LAMP_MAT.emissiveIntensity=0.35+fn*4;POOL_MAT.opacity=fn*0.55;const cc=col('cloud').convertSRGBToLinear();for(const c of CLOUDS){c.material.color.copy(cc);c.material.opacity=c.userData.op*(1-fn*0.5);}
 todVal=TOD.t;captureWxBase();if(regen)regenEnv();}
function setTOD(t,cycle){TOD.t=((t%1)+1)%1;if(cycle!=null)TOD.cycle=cycle;applyTOD(true);syncTodUI();saveDirty=true;}
function syncTodUI(){document.querySelectorAll('.tod').forEach(b=>b.classList.toggle('on',!TOD.cycle&&Math.abs(parseFloat(b.dataset.t)-TOD.t)<0.01));const c=$('todCycle');if(c)c.checked=TOD.cycle;}
function updateTOD(dt){if(!TOD.cycle)return;TOD.t=(TOD.t+dt/900)%1;applyTOD(false);todEnvT-=dt;if(todEnvT<=0){todEnvT=3;regenEnv();}}
document.querySelectorAll('.tod').forEach(b=>b.addEventListener('click',()=>setTOD(parseFloat(b.dataset.t),false)));
$('todCycle').addEventListener('change',e=>{TOD.cycle=e.target.checked;syncTodUI();saveDirty=true;});
applyTOD(true);syncTodUI();applyLaserColor();
if(SAVED_HERO&&SAVED_HERO.cos)heroCostumes=SAVED_HERO.cos;heroCostumes.guardian=heroCostumes.guardian||Object.assign({},costume);applyHero(SAVED_HERO&&SAVED_HERO.id||'guardian',true);$('killsV').textContent=(prog.kills||0).toLocaleString('tr-TR');setMap(SAVED_MAP,true);AGG=clamp(SAVED_AGG,0,5);aggButtons($('aggRow'));if(typeof SAVED_QUAL==='number'){QUAL=clamp(SAVED_QUAL,0,3);}qualButtons($('qualRow'));WX.mode=SAVED_WX||0;WX.kr=(WX.mode===1||WX.mode===2)?1:0;WX.ks=WX.mode===3?1:0;WX.k=[0,0.6,1,0.5][WX.mode];syncWxUI();
/* cinematic post-processing: HDR render, bloom, ACES tonemapping, vignette (own pipeline, no external libs) */
const POST={enabled:!IS_MOBILE,ok:false};let rtScene,rtA,rtB,rtC,postScene,postCam,postQuad,mBright,mBlur,mFinal;
function initPost(){try{
 if(!renderer.capabilities.isWebGL2)return false;
 if(!renderer.extensions.get('EXT_color_buffer_float')&&!renderer.extensions.get('EXT_color_buffer_half_float'))return false;
 const opt={type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter};
 rtScene=THREE.WebGLMultisampleRenderTarget?new THREE.WebGLMultisampleRenderTarget(4,4,Object.assign({depthBuffer:true},opt)):new THREE.WebGLRenderTarget(4,4,Object.assign({depthBuffer:true},opt));if(rtScene.samples!==undefined)rtScene.samples=4;
 rtA=new THREE.WebGLRenderTarget(4,4,Object.assign({depthBuffer:false},opt));rtB=new THREE.WebGLRenderTarget(4,4,Object.assign({depthBuffer:false},opt));rtC=new THREE.WebGLRenderTarget(4,4,Object.assign({depthBuffer:false},opt));
 const VS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
 mBright=new THREE.ShaderMaterial({uniforms:{t:{value:null},th:{value:2.4}},vertexShader:VS,fragmentShader:'uniform sampler2D t;uniform float th;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb;float l=max(max(c.r,c.g),c.b);float k=smoothstep(th,th*1.8,l);gl_FragColor=vec4(min(c,vec3(12.0))*k,1.0);}',depthTest:false,depthWrite:false});
 mBlur=new THREE.ShaderMaterial({uniforms:{t:{value:null},dir:{value:new THREE.Vector2()}},vertexShader:VS,fragmentShader:'uniform sampler2D t;uniform vec2 dir;varying vec2 vUv;void main(){vec3 s=texture2D(t,vUv).rgb*0.227;s+=(texture2D(t,vUv+dir*1.384).rgb+texture2D(t,vUv-dir*1.384).rgb)*0.316;s+=(texture2D(t,vUv+dir*3.23).rgb+texture2D(t,vUv-dir*3.23).rgb)*0.07;gl_FragColor=vec4(s,1.0);}',depthTest:false,depthWrite:false});
 mFinal=new THREE.ShaderMaterial({uniforms:{tS:{value:null},tB:{value:null},exposure:{value:1},bloom:{value:0.38},uT:{value:0}},vertexShader:VS,fragmentShader:'uniform sampler2D tS;uniform sampler2D tB;uniform float exposure;uniform float bloom;uniform float uT;varying vec2 vUv;'+
  'vec3 aces(vec3 c){c*=exposure/0.6;const mat3 I=mat3(vec3(0.59719,0.07600,0.02840),vec3(0.35458,0.90834,0.13383),vec3(0.04823,0.01566,0.83777));const mat3 O=mat3(vec3(1.60475,-0.10208,-0.00327),vec3(-0.53108,1.10813,-0.07276),vec3(-0.07367,-0.00605,1.07602));c=I*c;vec3 a=c*(c+0.0245786)-0.000090537;vec3 b=c*(0.983729*c+0.4329510)+0.238081;c=O*(a/b);return clamp(c,0.0,1.0);}'+
  'vec3 srgb(vec3 c){return mix(pow(c,vec3(0.41666))*1.055-vec3(0.055),c*12.92,vec3(lessThanEqual(c,vec3(0.0031308))));}'+
  'void main(){vec3 c=texture2D(tS,vUv).rgb+texture2D(tB,vUv).rgb*bloom;c=aces(c);vec2 q=vUv-0.5;c*=1.0-dot(q,q)*0.32;float l=dot(c,vec3(0.2126,0.7152,0.0722));c=mix(vec3(l),c,0.92);c+=vec3(-0.008,0.0,0.012)*(1.0-l)+vec3(0.012,0.005,-0.01)*l;c=clamp(c,0.0,1.0);vec3 o=srgb(c);float n=fract(sin(dot(vUv*vec2(1733.7,911.3)+fract(uT)*91.7,vec2(12.9898,78.233)))*43758.5453);o+=(n-0.5)*0.022;gl_FragColor=vec4(o,1.0);}',depthTest:false,depthWrite:false});
 postScene=new THREE.Scene();postCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);postQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mFinal);postQuad.frustumCulled=false;postScene.add(postQuad);
 return true;}catch(e){console.warn('Post disabled',e);return false;}}
function resizePost(){if(!POST.ok)return;const v=new THREE.Vector2();renderer.getDrawingBufferSize(v);const w=Math.max(4,v.x|0),h=Math.max(4,v.y|0);rtScene.setSize(w,h);rtA.setSize(Math.max(4,w>>1),Math.max(4,h>>1));rtB.setSize(Math.max(4,w>>2),Math.max(4,h>>2));rtC.setSize(Math.max(4,w>>2),Math.max(4,h>>2));}
function setPost(on){POST.enabled=on&&POST.ok;renderer.toneMapping=POST.enabled?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;const lv=POST.enabled?1:0;dustPS.mat.uniforms.lin.value=lv;glowPS.mat.uniforms.lin.value=lv;LIN_MATS.forEach(m=>m.uniforms.lin.value=lv);const cb=$('postOn');if(cb)cb.checked=POST.enabled;}
function pass(mat,target){postQuad.material=mat;renderer.setRenderTarget(target);renderer.render(postScene,postCam);}
function renderFrame(){if(!POST.enabled){renderer.setRenderTarget(null);drawScene();return;}
 renderer.setRenderTarget(rtScene);drawScene();
 mBright.uniforms.t.value=rtScene.texture;pass(mBright,rtA);
 const bw=rtB.width,bh=rtB.height;
 mBlur.uniforms.t.value=rtA.texture;mBlur.uniforms.dir.value.set(1/bw,0);pass(mBlur,rtB);
 mBlur.uniforms.t.value=rtB.texture;mBlur.uniforms.dir.value.set(0,1/bh);pass(mBlur,rtC);
 mBlur.uniforms.t.value=rtC.texture;mBlur.uniforms.dir.value.set(2/bw,0);pass(mBlur,rtB);
 mBlur.uniforms.t.value=rtB.texture;mBlur.uniforms.dir.value.set(0,2/bh);pass(mBlur,rtC);
 mFinal.uniforms.uT.value=time*0.37;mFinal.uniforms.tS.value=rtScene.texture;mFinal.uniforms.tB.value=rtC.texture;mFinal.uniforms.exposure.value=renderer.toneMappingExposure;pass(mFinal,null);}
POST.ok=initPost();if(SAVED_POST!==null)POST.enabled=SAVED_POST;

setPost(POST.enabled);$('postOn').addEventListener('change',e=>{setPost(e.target.checked);saveDirty=true;});if(!POST.ok)$('postNote').textContent='Tarayıcın bu grafik modunu desteklemiyor, standart görüntü kullanılıyor.';
applyCostume();
$('playBtn').onclick=startGame;$('resumeBtn').onclick=resume;$('upClose').onclick=closeUpgrades;$('menuUp').onclick=()=>openUpgrades('menu');$('pauseUp').onclick=()=>openUpgrades('pause');
$('sens').value=sens;$('sens').oninput=e=>{sens=parseFloat(e.target.value);saveDirty=true;};
if(IS_TOUCH){$('touchNote').textContent='Sol tarafa dokunup sürükleyerek yürü (sonuna kadar itersen koşarsın), sağ tarafı sürükleyerek etrafına bak. Güçler, uçuş ve kamera butonları sağ tarafta.';document.body.classList.add('touch');fallback=true;}
const TOUCH={mx:0,my:0,sprint:false,stick:null,look:null,ox:0,oy:0,lx:0,ly:0};
{const tz=$('touch'),base=$('stickBase'),knob=$('stickKnob');
 tz.addEventListener('pointerdown',e=>{if(state!=='play'||e.target.closest('.tb'))return;e.preventDefault();try{tz.setPointerCapture(e.pointerId);}catch(_){}
  if(e.clientX<innerWidth*0.45&&TOUCH.stick===null){TOUCH.stick=e.pointerId;TOUCH.ox=e.clientX;TOUCH.oy=e.clientY;base.style.left=e.clientX+'px';base.style.top=e.clientY+'px';base.style.display='block';knob.style.transform='translate(0,0)';}
  else if(TOUCH.look===null){TOUCH.look=e.pointerId;TOUCH.lx=e.clientX;TOUCH.ly=e.clientY;}});
 tz.addEventListener('pointermove',e=>{if(e.pointerId===TOUCH.stick){let dx=e.clientX-TOUCH.ox,dy=e.clientY-TOUCH.oy;const L=Math.hypot(dx,dy),R=60;if(L>R){dx*=R/L;dy*=R/L;}TOUCH.mx=dx/R;TOUCH.my=-dy/R;TOUCH.sprint=L>R*0.95;knob.style.transform='translate('+dx+'px,'+dy+'px)';}
  else if(e.pointerId===TOUCH.look){lookX+=(e.clientX-TOUCH.lx)*1.6;lookY+=(e.clientY-TOUCH.ly)*1.6;TOUCH.lx=e.clientX;TOUCH.ly=e.clientY;}});
 const endT=e=>{if(e.pointerId===TOUCH.stick){TOUCH.stick=null;TOUCH.mx=TOUCH.my=0;TOUCH.sprint=false;base.style.display='none';}if(e.pointerId===TOUCH.look)TOUCH.look=null;};
 tz.addEventListener('pointerup',endT);tz.addEventListener('pointercancel',endT);
 document.querySelectorAll('#touch .tb').forEach(b=>{if(b.id==='tPause'||b.id==='tFP'||b.id==='tLock')return;const k=b.dataset.k,m=b.dataset.m;
  const down=e=>{e.preventDefault();e.stopPropagation();if(state!=='play')return;try{b.setPointerCapture(e.pointerId);}catch(_){}b.classList.add('on');if(k){keys[k]=true;pressed[k]=true;}if(m==='L')mouseL=true;if(m==='R')mouseR=true;};
  const up=e=>{e.stopPropagation();b.classList.remove('on');if(k)keys[k]=false;if(m==='L')mouseL=false;if(m==='R')mouseR=false;};
  b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);});
 $('tLock').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(state==='play')toggleLock();});
 $('tFP').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(state==='play')toggleFP();});
 $('tPause').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(state==='play')pause();});}
const GAME_KEYS=['Tab','Space','KeyQ','KeyE','KeyF','KeyC','ShiftLeft','ShiftRight','KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown'];
addEventListener('keydown',e=>{const c=e.code;if(GAME_KEYS.includes(c)&&state!=='menu')e.preventDefault();
 if((c==='Tab'||c==='KeyU')&&!e.repeat){e.preventDefault();if(state==='play')openUpgrades('play');else if(state==='pause')openUpgrades('pause');else if(state==='upgrade')closeUpgrades();return;}
 if(c==='Escape'){if(!$('maps').classList.contains('hidden')){closeMaps();return;}if(state==='heroes'){closeHeroes();return;}if(state==='shop'){closeShop();return;}if(state==='costume'){closeCostume();return;}if(state==='upgrade'){closeUpgrades();return;}if(fallback){if(state==='play')pause();else if(state==='pause')resume();}return;}
 if(c==='KeyK'&&!e.repeat&&state==='play'){openCostume('play');return;}
 if(c==='KeyT'&&!e.repeat&&state==='play'){toggleCivilian();return;}
 if(c==='KeyV'&&!e.repeat&&state==='play'){toggleFP();return;}
 if(c==='KeyM'&&!e.repeat&&state==='play'){openShop('play');return;}
 if(c==='KeyP'&&!e.repeat){if(state==='play')pause();else if(state==='pause')resume();return;}
 if(state!=='play')return;if(!e.repeat)pressed[c]=true;keys[c]=true;});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('blur',()=>{clearInput();if(state==='play'&&fallback)pause();});
view.addEventListener('mousedown',e=>{if(state!=='play')return;if(!locked&&!fallback){lock();return;}if(e.button===0)mouseL=true;if(e.button===2)mouseR=true;});
addEventListener('mouseup',e=>{if(e.button===0)mouseL=false;if(e.button===2)mouseR=false;});
view.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(IS_TOUCH)return;if(state==='play'&&(locked||fallback)){lookX+=e.movementX||0;lookY+=e.movementY||0;}});

/* ---------- loop ---------- */
var menuDrawn=0,prevState='';
function resize(){menuDrawn=0;const w=app.clientWidth,h=app.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();lc.width=w;lc.height=h;resizePost();}
addEventListener('resize',resize);resize();

let last=performance.now();
function frame(now){requestAnimationFrame(frame);const raw=now-last;let dt=Math.min(raw/1000,0.05);last=now;
 frAcc+=Math.min(raw,100);if(++frN>=90){const avg=frAcc/frN;frAcc=0;frN=0;let np=curPR;if(now-lastPRChange>5000){if(avg>24)np=Math.max(IS_MOBILE?0.7:0.8,curPR-0.15);else if(avg<13)np=Math.min(QCAP,curPR+0.1);}if(np!==curPR)lastPRChange=now;if(Math.abs(np-curPR)>0.01){curPR=np;renderer.setPixelRatio(curPR);resize();}}
 if(state!==prevState){prevState=state;menuDrawn=0;}
 if(state==='menu'&&menuDrawn>2){lookX=lookY=0;for(const k in pressed)delete pressed[k];return;}
 if(state==='play'){if(hitStop>0){hitStop-=dt;dt*=0.1;}time+=dt;
  const _ss=(HERO.rmb==='scope'&&mouseR&&state==='play')?0.35:1;yaw-=lookX*0.0022*sens*_ss;pitch=clamp(pitch+lookY*0.0022*sens*_ss,-1.25,1.35);lockSteer(dt);
  if(pl.dead){pl.deathT-=dt;$('deadT').textContent=String(Math.max(1,Math.ceil(pl.deathT)));pl.vel.x*=0.9;pl.vel.z*=0.9;pl.vel.y+=G*dt;pl.pos.y=Math.max(groundAt(pl.pos.x,pl.pos.y,pl.pos.z),pl.pos.y+pl.vel.y*dt);if(pl.deathT<=0)respawn();}
  if(!PHOTO){if(GRABBED)updateGrab(dt);else updatePlayer(dt);windBooms();trackStats(dt);}
  if(!pl.dead&&(time-pl.shootT<0.4||pl.laser)&&!pl.flying)pl.facing=turnAngle(pl.facing,yaw,damp(15,dt));
  updateCamera(dt,false);updateAim();
  if(pressed.KeyO)togglePhoto();if(pressed.KeyN)cycleTOD();if(pressed.KeyH)setWeather(WX.mode+1);
  if(!PHOTO&&!pl.dead&&!civOn){if(pressed.KeyZ)tryGrab();if(mouseL||pressed.KeyE)tryPunch();if(pressed.KeyQ)heroQ();if(pressed.KeyR)toggleLock();if(pressed.KeyX)togglePhase();if(HERO_ID==='twin'){if(pressed['Digit1'])allyCommand('attack');if(pressed['Digit2'])allyCommand('follow');if(pressed['Digit3'])clearAllies();}if(HERO.rmb==='megabeam'){for(let d=1;d<=9;d++)if(pressed['Digit'+d]){LBLV=d;toast('Lazer gücü '+d,'');}if(pressed['Digit0']){LBLV=10;toast('Lazer gücü 10','');}if(pressed['BracketRight']||pressed['Equal']||pressed['ArrowUp']){LBLV=Math.min(20,LBLV+1);toast('Lazer gücü '+LBLV,LBLV===20?'Azami güç':'');}if(pressed['BracketLeft']||pressed['Minus']||pressed['ArrowDown']){LBLV=Math.max(1,LBLV-1);toast('Lazer gücü '+LBLV,'');}}if(pressed.KeyB)toggleRest(1);if(pressed.KeyL)toggleRest(2);if(pressed.KeyG&&HERO.ult==='erase')tryErase();}
  {const want=!PHOTO&&HERO.rmb==='slow'&&mouseR&&pl.en>1&&!pl.dead&&!civOn;TS=want?Math.max(0,TS-dt*6):Math.min(1,TS+dt*4);if(want)pl.en=Math.max(0,pl.en-10*dt);if(want&&!tsOn){tsOn=true;sfx('charge',1);sfx('whoosh',1);toast('Zaman durdu','Sağ tıkı bırakınca devam eder');}else if(!want&&tsOn){tsOn=false;sfx('whoosh',0.7);}view.style.filter=TS<0.98&&!PHOTO?'saturate('+(0.12+0.88*TS).toFixed(2)+') contrast(1.1) brightness(0.95)':'saturate(1.04)';}
  if(PHOTO)TS=0;updateLaser(dt);updateAltPowers(dt);updateProjectiles(dt*TS);updateEnemies(dt*TS);updateEvent(dt);updateAmbient(dt);
 }else if(state==='menu'){pitch=0.12;updateCamera(dt,true);}
 else if(state==='costume'||state==='heroes'){time+=dt;yaw=turnAngle(yaw,pl.facing+Math.PI+Math.sin(time*0.45)*0.75,damp(3,dt));pitch=lerp(pitch,0.06,damp(3,dt));updateCamera(dt,'cos');}
 else updateLaser(0);
 const sim=(state==='play'||state==='costume'||state==='heroes')?dt:0;
 updateLOD(dt);if(state==='play'||state==='menu'){const wsim=sim*TS;WT+=wsim;updateSpace(sim);updateWeather(sim);updateBoats(wsim);updateMolten(wsim);updateChunks(wsim);updateIce(wsim);updateCrowd();updateHoles(wsim);updateWave(wsim);villainTick(sim);updateBolts(wsim);updateCraters(wsim);updateMilitary(wsim);updateFires(wsim);updateAllies(wsim);if(typeof netTick==='function')netTick(wsim);}if(sim>0)updateTOD(sim);{const ws=sim*TS;updateBuildings(ws);if(!ARENA)updateCity(ws);updateArena();updateDebris(ws);updatePS(dustPS,ws);updatePS(glowPS,ws);updateRings(ws);updateFX(ws);}
 flashI=Math.max(0,flashI-sim*14);flash.intensity=flashI;
 animateHero(sim);
 if(state!=='menu'&&state!=='costume'&&state!=='heroes')updateHUD(sim);
 audioUpdate(dt);
 sky.position.copy(camera.position);renderFrame();if(state==='menu')menuDrawn++;
 lookX=lookY=0;for(const k in pressed)delete pressed[k];
 if(saveDirty&&performance.now()-saveT>2000){saveT=performance.now();saveNow();}}
try{applyQuality();}catch(e){console.error(e);}
requestAnimationFrame(frame);
