import {Mesh, Program, Renderer, Triangle} from "ogl";
import {useEffect, useRef} from "react";

// From React Bits' Grainient (https://reactbits.dev/backgrounds/grainient), MIT + Commons Clause:
// a slowly warping, grainy three-colour gradient. Trimmed to the props used here; holds still
// (one frame) for reduced motion, and pauses while off screen or in a background tab.

export type GrainientProps = {
  /** Three hex colours: light, mid, deep. */
  colors: [string, string, string];
  className?: string;
};

const hexToRgb = (hex: string) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return new Float32Array([1, 1, 1]);
  return new Float32Array([1, 2, 3].map(i => parseInt(match[i]!, 16) / 255));
};

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed;
uniform float uColorBalance;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uBlendAngle;
uniform float uBlendSoftness;
uniform float uRotationAmount;
uniform float uNoiseScale;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform vec2 uCenterOffset;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uLightMode;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);} 
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);} 
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void mainImage(out vec4 o, vec2 C){
  float t=iTime*uTimeSpeed;
  vec2 uv=C/iResolution.xy;
  float ratio=iResolution.x/iResolution.y;
  vec2 tuv=uv-0.5+uCenterOffset;
  tuv/=max(uZoom,0.001);

  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
  tuv.y*=ratio;

  float frequency=uWarpFrequency;
  float ws=max(uWarpStrength,0.001);
  float amplitude=uWarpAmplitude/ws;
  float warpTime=t*uWarpSpeed;
  tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
  tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);

  vec3 colLav=uColor1;
  vec3 colOrg=uColor2;
  vec3 colDark=uColor3;
  float b=uColorBalance;
  float s=max(uBlendSoftness,0.0);
  mat2 blendRot=Rot(radians(uBlendAngle));
  float blendX=(tuv*blendRot).x;
  float edge0=-0.3-b-s;
  float edge1=0.2-b+s;
  float v0=0.5-b+s;
  float v1=-0.3-b-s;
  vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
  vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));

  vec2 grainUv=uv*max(uGrainScale,0.001);
  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);} 
  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
  col+=(grain-0.5)*uGrainAmount;

  col=(col-0.5)*uContrast+0.5;
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(luma),col,uSaturation);
  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
  col=clamp(col,0.0,1.0);
  if(uLightMode>0.5){
    float energy=max(max(col.r,col.g),col.b);
    vec3 hue=col/max(energy,0.001);
    float chroma=length(col-vec3(dot(col,vec3(0.333333))));
    float coverage=clamp(0.12+chroma*1.15+energy*0.18,0.0,0.88);
    col=mix(vec3(1.0),clamp(hue*0.58+col*0.18,0.0,1.0),coverage);
  }

  o=vec4(col,1.0);
}
void main(){
  vec4 o=vec4(0.0);
  mainImage(o,gl_FragCoord.xy);
  fragColor=o;
}
`;

// The original component's defaults, as uniforms.
const UNIFORMS = {
  uTimeSpeed: 0.25,
  uColorBalance: 0,
  uWarpStrength: 1,
  uWarpFrequency: 5,
  uWarpSpeed: 2,
  uWarpAmplitude: 50,
  uBlendAngle: 0,
  uBlendSoftness: 0.05,
  uRotationAmount: 500,
  uNoiseScale: 2,
  uGrainAmount: 0.1,
  uGrainScale: 2,
  uGrainAnimated: 0,
  uContrast: 1.5,
  uGamma: 1,
  uSaturation: 1,
  uZoom: 0.9,
  uLightMode: 0,
};

export default function GrainientCanvas({colors, className}: GrainientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [color1, color2, color3] = colors;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new Renderer({
      webgl: 2,
      alpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    const gl = renderer.gl;
    const canvas = gl.canvas;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        ...Object.fromEntries(Object.entries(UNIFORMS).map(([k, v]) => [k, {value: v}])),
        iTime: {value: 0},
        iResolution: {value: new Float32Array([1, 1])},
        uCenterOffset: {value: new Float32Array([0, 0])},
        uColor1: {value: hexToRgb(color1)},
        uColor2: {value: hexToRgb(color2)},
        uColor3: {value: hexToRgb(color3)},
      },
    });
    const mesh = new Mesh(gl, {geometry: new Triangle(gl), program});
    const uniforms = program.uniforms as Record<string, {value: unknown}>;

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
      uniforms.iResolution!.value = new Float32Array([
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
      ]);
      renderer.render({scene: mesh});
    };
    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(container);
    setSize();
    if (reduceMotion) {
      return () => {
        resizeObserver.disconnect();
        canvas.remove();
      };
    }

    let frame = 0;
    let onScreen = true;
    const start = performance.now();
    const loop = (now: number) => {
      uniforms.iTime!.value = (now - start) / 1000;
      renderer.render({scene: mesh});
      frame = requestAnimationFrame(loop);
    };
    const play = () => {
      if (onScreen && !document.hidden && frame === 0) frame = requestAnimationFrame(loop);
    };
    const pause = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? false;
      if (onScreen) play();
      else pause();
    });
    intersection.observe(container);
    const onVisibility = () => (document.hidden ? pause() : play());
    document.addEventListener("visibilitychange", onVisibility);
    play();

    return () => {
      pause();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.remove();
    };
  }, [color1, color2, color3]);

  return <div ref={containerRef} className={className} />;
}
