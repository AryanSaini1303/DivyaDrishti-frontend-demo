"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import styles from "./DivyaDrishtiCore.module.css";

function hexToRgb(hex) {
  const v = parseInt(hex.replace("#", ""), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
function fibonacciShell(n, r) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    pts.push({
      x: Math.cos(theta) * radiusAtY * r,
      y: y * r,
      z: Math.sin(theta) * radiusAtY * r,
    });
  }
  return pts;
}

// state: "idle" | "listening" | "thinking" | "speaking" | "data"
export default function DivyaDrishtiCore({ state, color = "#4AF2A1" }) {
  const containerRef = useRef(null);
  const canvas2dRef = useRef(null);
  const canvas3dRef = useRef(null);

  // live-updated by prop-change effect, read inside the mount-only animation loops
  const stateRef = useRef(state);
  const colorRef = useRef(hexToRgb(color));
  const setColorFnRef = useRef(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const rgb = hexToRgb(color);
    colorRef.current = rgb;
    setColorFnRef.current?.(rgb);
  }, [color]);

  // mount-only: sets up both canvases and animation loops, tears down on unmount
  useEffect(() => {
    const container = containerRef.current;
    const canvas2d = canvas2dRef.current;
    const canvas3d = canvas3dRef.current;
    if (!container || !canvas2d || !canvas3d) return;

    let raf2d = 0;
    let raf3d = 0;
    let t2 = 0;
    let t3 = 0;

    // ---------- 2D layer: rings + veins ----------
    const ctx = canvas2d.getContext("2d");
    let W = 0, H = 0, CX = 0, CY = 0;

    function rgba(alpha) {
      const c = colorRef.current;
      return `rgba(${c.r},${c.g},${c.b},${alpha})`;
    }

    const VEIN_COUNT = 9;
    const veins = Array.from({ length: VEIN_COUNT }, (_, i) => ({
      angle: (i / VEIN_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
      lenBase: 90 + Math.random() * 40,
      phase: Math.random() * Math.PI * 2,
    }));

    const EQ_SEGMENTS = 48;
    const eqSeeds = Array.from({ length: EQ_SEGMENTS }, () => Math.random() * Math.PI * 2);

    function drawRing(radius, rotation, dashLen, gapLen, alpha, width) {
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(rotation);
      ctx.setLineDash([dashLen, gapLen]);
      ctx.lineWidth = width;
      ctx.strokeStyle = rgba(alpha);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawEqualizerRing(baseRadius) {
      ctx.save();
      ctx.translate(CX, CY);
      for (let i = 0; i < EQ_SEGMENTS; i++) {
        const a = (i / EQ_SEGMENTS) * Math.PI * 2;
        const amp = 6 + Math.abs(Math.sin(t2 * 0.12 + eqSeeds[i] * 3)) * 22;
        const x1 = Math.cos(a) * baseRadius, y1 = Math.sin(a) * baseRadius;
        const x2 = Math.cos(a) * (baseRadius + amp), y2 = Math.sin(a) * (baseRadius + amp);
        ctx.strokeStyle = rgba(0.55 + (amp / 28) * 0.4);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawVeins(spread, speedMult, litFraction) {
      veins.forEach((v) => {
        const len = v.lenBase * spread;
        const dx = Math.cos(v.angle), dy = Math.sin(v.angle) * 0.6;
        const x2 = CX + dx * len, y2 = CY + dy * len;

        ctx.save();
        ctx.strokeStyle = rgba(0.28);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const pulseT = ((t2 * 0.006 * speedMult) + v.phase) % 1;
        const px = CX + dx * len * pulseT;
        const py = CY + dy * len * pulseT;
        ctx.fillStyle = rgba(0.9);
        ctx.shadowBlur = 8;
        ctx.shadowColor = rgba(0.9);
        ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        ctx.shadowBlur = 0;

        if (litFraction > 0) {
          ctx.fillStyle = rgba(0.5 * litFraction);
          ctx.fillRect(x2 - 2, y2 - 2, 4, 4);
        }
        ctx.restore();
      });
    }

    function resize2d() {
      W = canvas2d.width = container.clientWidth;
      H = canvas2d.height = container.clientHeight;
      CX = W / 2;
      CY = H / 2;
    }
    resize2d();

    function draw2d() {
      t2 += 1;
      ctx.clearRect(0, 0, W, H);
      const s = stateRef.current;

      let veinSpread = 1, veinSpeed = 1, useEq = false;
      const ring1 = { r: 70, rot: t2 * 0.0012, dash: 18, gap: 10, a: 0.35, w: 1 };
      const ring2 = { r: 95, rot: -t2 * 0.0009, dash: 6, gap: 14, a: 0.22, w: 1 };

      if (s === "listening") {
        veinSpeed = 1.6;
        useEq = true;
      } else if (s === "thinking") {
        veinSpread = 0.7;
        veinSpeed = 3.4;
        ring1.rot = t2 * 0.006; ring2.rot = -t2 * 0.0055;
        ring1.a = 0.5; ring2.a = 0.35;
      } else if (s === "speaking") {
        veinSpeed = 1.4;
      } else if (s === "data") {
        veinSpread = 1.7;
        veinSpeed = 0.7;
        ring1.r = 130; ring2.r = 150;
        ring1.a = 0.15; ring2.a = 0.1;
      }

      drawRing(ring1.r, ring1.rot, ring1.dash, ring1.gap, ring1.a, ring1.w);
      drawRing(ring2.r, ring2.rot, ring2.dash, ring2.gap, ring2.a, ring2.w);
      if (useEq) drawEqualizerRing(70);
      drawVeins(veinSpread, veinSpeed, s === "data" ? 1 : 0.4);

      raf2d = requestAnimationFrame(draw2d);
    }
    draw2d();

    // ---------- 3D layer: wireframe core + particle field ----------
    const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 130;

    function resize3d() {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize3d();

    const makeColor = () => {
      const c = colorRef.current;
      return new THREE.Color(c.r / 255, c.g / 255, c.b / 255);
    };

    const innerCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(13, 1),
      new THREE.MeshBasicMaterial({ color: makeColor(), wireframe: true, transparent: true, opacity: 0.95 })
    );
    const midShell = new THREE.Mesh(
      new THREE.DodecahedronGeometry(23, 0),
      new THREE.MeshBasicMaterial({ color: makeColor(), wireframe: true, transparent: true, opacity: 0.5 })
    );
    const outerShell = new THREE.Mesh(
      new THREE.OctahedronGeometry(33, 0),
      new THREE.MeshBasicMaterial({ color: makeColor(), wireframe: true, transparent: true, opacity: 0.28 })
    );
    outerShell.rotation.x = 0.6;
    scene.add(innerCore, midShell, outerShell);

    const SHELLS = [
      { r: 38, n: 46 },
      { r: 50, n: 74 },
      { r: 63, n: 96 },
    ];
    const shellPointSets = SHELLS.map((s) => fibonacciShell(s.n, s.r));
    const pts = shellPointSets.flat();

    const positions = new Float32Array(pts.length * 3);
    const phases = new Float32Array(pts.length);
    pts.forEach((p, i) => {
      positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
      phases[i] = Math.random() * Math.PI * 2;
    });

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const colorArray = new Float32Array(pts.length * 3);
    particleGeo.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 1.7, transparent: true, opacity: 0.95, vertexColors: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    function updateTwinkle() {
      const colAttr = particleGeo.attributes.color;
      const base = colorRef.current;
      for (let i = 0; i < pts.length; i++) {
        const b = 0.55 + 0.45 * Math.sin(t3 * 0.025 + phases[i]);
        colAttr.array[i * 3] = (base.r / 255) * b;
        colAttr.array[i * 3 + 1] = (base.g / 255) * b;
        colAttr.array[i * 3 + 2] = (base.b / 255) * b;
      }
      colAttr.needsUpdate = true;
    }

    function makeGlowTexture() {
      // Built as a raw pixel buffer (DataTexture) rather than from an offscreen
      // canvas (CanvasTexture) — canvas/image-sourced textures hit a Chrome WebGL
      // driver quirk that logs a spurious "texImage3D... 3D textures" warning even
      // though nothing here uses 3D textures. Raw-data uploads take a different
      // code path entirely and avoid it.
      const size = 64;
      const data = new Uint8Array(size * size * 4);
      const center = size / 2;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - center, dy = y - center;
          const dist = Math.sqrt(dx * dx + dy * dy) / center; // 0 at center, 1 at edge
          const falloff = Math.pow(Math.max(0, 1 - dist), 1.8); // eased, matches the old radial gradient's softness
          const i = (y * size + x) * 4;
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = Math.round(falloff * 255);
        }
      }
      const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
      texture.needsUpdate = true; // DataTexture needs this set explicitly to trigger the initial upload
      return texture;
    }
    const glowSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(), color: makeColor(), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    glowSprite.scale.set(90, 90, 1);
    scene.add(glowSprite);

    setColorFnRef.current = (rgb) => {
      const col = new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255);
      innerCore.material.color = col;
      midShell.material.color = col;
      outerShell.material.color = col;
      glowSprite.material.color = col;
    };

    function animate3d() {
      t3 += 1;
      const s = stateRef.current;
      let scaleMult = 1, spinMult = 1, particleSpread = 1, glowScale = 1;

      if (s === "listening") {
        spinMult = 1.3;
        glowScale = 1 + Math.abs(Math.sin(t3 * 0.08)) * 0.25;
        particleSpread = 1.06;
      } else if (s === "thinking") {
        spinMult = 3.2;
        scaleMult = 0.85;
        glowScale = 1.15 + Math.sin(t3 * 0.15) * 0.1;
        particleSpread = 0.9;
      } else if (s === "speaking") {
        const env = Math.abs(Math.sin(t3 * 0.14)) * 0.6 + Math.abs(Math.sin(t3 * 0.29)) * 0.4;
        glowScale = 1 + env * 0.35;
        spinMult = 1.15;
      } else if (s === "data") {
        scaleMult = 1.25;
        particleSpread = 1.35;
        spinMult = 0.6;
        glowScale = 1.2;
      }

      innerCore.rotation.x += 0.012 * spinMult;
      innerCore.rotation.y += 0.017 * spinMult;
      midShell.rotation.x -= 0.006 * spinMult;
      midShell.rotation.y += 0.009 * spinMult;
      outerShell.rotation.z += 0.004 * spinMult;
      outerShell.rotation.y -= 0.007 * spinMult;
      particles.rotation.y += 0.0022 * spinMult;
      particles.rotation.x += 0.0009 * spinMult;

      const sc = scaleMult;
      innerCore.scale.set(sc, sc, sc);
      midShell.scale.set(sc, sc, sc);
      outerShell.scale.set(sc, sc, sc);
      particles.scale.set(particleSpread, particleSpread, particleSpread);
      glowSprite.scale.set(90 * glowScale, 90 * glowScale, 1);
      updateTwinkle();

      renderer.render(scene, camera);
      raf3d = requestAnimationFrame(animate3d);
    }
    animate3d();

    const handleResize = () => { resize2d(); resize3d(); };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf2d);
      cancelAnimationFrame(raf3d);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      innerCore.geometry.dispose();
      innerCore.material.dispose();
      midShell.geometry.dispose();
      midShell.material.dispose();
      outerShell.geometry.dispose();
      outerShell.material.dispose();
      setColorFnRef.current = null;
    };
    // mount-only — state/color are read via refs above, not effect deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      <canvas ref={canvas3dRef} className={styles.canvas} />
      <canvas ref={canvas2dRef} className={styles.canvas} />
    </div>
  );
}