"use client";

import { useEffect, useRef } from "react";

// A slow, flowing gradient field in the brand colours, drawn with a tiny
// WebGL shader at low resolution (the browser's upscaling keeps it soft).
// It pauses when the tab is hidden and stays still for reduced-motion users.

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 res;
uniform float t;
uniform vec2 mouse;

// 2D simplex noise (Ashima Arts / Stefan Gustavson, MIT).
vec3 permute(vec3 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 q = vec2(uv.x * res.x / res.y, uv.y);
  float s = t * 0.035;
  // Domain-warped noise gives slow, silky folds.
  vec2 w = vec2(snoise(q * 0.9 + vec2(s, -s)), snoise(q * 0.9 + vec2(-s, s * 0.7) + 4.0));
  float n1 = snoise(q * 1.1 + w * 0.8 + vec2(s * 0.6, 0.0));
  float n2 = snoise(q * 1.6 - w * 0.6 + vec2(0.0, s * 0.8) + 9.0);

  vec3 violet = vec3(0.545, 0.361, 0.965);
  vec3 pink   = vec3(0.925, 0.282, 0.600);
  vec3 orange = vec3(0.984, 0.573, 0.235);
  vec3 col = mix(violet, pink, smoothstep(-0.6, 0.7, n1));
  col = mix(col, orange, smoothstep(0.35, 0.95, n2) * 0.55);

  // Strongest near the top (where the hero is), fading into the page.
  float bands = smoothstep(-0.15, 0.9, n1 * 0.7 + n2 * 0.5);
  float glow = smoothstep(-0.2, 1.0, uv.y) * (0.25 + 0.75 * bands);
  // Gentle light that follows the pointer.
  glow += 0.18 * smoothstep(0.5, 0.0, distance(uv, mouse));
  float intensity = 0.34 * glow;

  vec3 base = vec3(0.024, 0.024, 0.039);
  gl_FragColor = vec4(base + col * intensity, 1.0);
}`;

export function AnimatedBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return; // the static CSS glow stays as the fallback

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.warn("Background shader:", gl.getShaderInfoLog(sh));
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("Background shader link failed:", gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "res");
    const uT = gl.getUniformLocation(prog, "t");
    const uMouse = gl.getUniformLocation(prog, "mouse");

    const SCALE = 0.35; // render at about a third of the resolution
    const resize = () => {
      canvas.width = Math.max(1, Math.round(window.innerWidth * SCALE));
      canvas.height = Math.max(1, Math.round(window.innerHeight * SCALE));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const target = { x: 0.5, y: 0.8 };
    const mouse = { x: 0.5, y: 0.8 };
    const onMove = (e: PointerEvent) => {
      target.x = e.clientX / window.innerWidth;
      target.y = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now() - 40_000; // start mid-flow, not from a flat frame
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 33) return; // ~30 fps is plenty for slow motion
      last = now;
      mouse.x += (target.x - mouse.x) * 0.04;
      mouse.y += (target.y - mouse.y) * 0.04;
      gl.uniform1f(uT, (now - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    if (reduced) {
      gl.uniform1f(uT, 40);
      gl.uniform2f(uMouse, 0.5, 0.8);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      raf = requestAnimationFrame(draw);
    }
    canvas.dataset.ready = "true";

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="bg-canvas" aria-hidden />;
}
