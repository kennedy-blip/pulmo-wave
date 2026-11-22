// PULMO-WAVE — airflow_turbulence.wgsl
// WebGPU WGSL shader: 3D bronchial airflow particle vortex + refractive
// liquid-glass surface. Uniform `flow` (Q(t) L/s) and `zoneTint` drive
// particle velocity, swirl, and clinical color blobs. WebGL2/Canvas2D
// fallback is implemented in src/components/VortexCanvas.vue.
struct Uniforms {
  time: f32,
  flow: f32,      // live exhalation flow rate Q(t) in L/s (0..12)
  zoneTint: vec3, // clinical zone color (green/yellow/red)
  resolution: vec2,
  lowGpu: f32,    // 1.0 = Eco-Glass low-GPU 2D mode
};
@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  return vec4<f32>(pos[i], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) frag: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = frag.xy / u.resolution;
  let c = uv - 0.5;
  let r = length(c) + 0.0001;
  let ang = atan2(c.y, c.x);

  // Vortex swirl: angular velocity scales with exhalation flow.
  let swirl = u.time * (0.25 + u.flow * 0.55) + ang * 2.0 - r * 6.0;
  let bands = sin(swirl * 3.14159) * 0.5 + 0.5;

  // Refractive liquid-glass blobs (3 clinical color lobes).
  let blob1 = exp(-pow(length(c - vec2<f32>(sin(u.time * 0.4) * 0.28, cos(u.time * 0.3) * 0.28)), 2.0) * 6.0);
  let blob2 = exp(-pow(length(c - vec2<f32>(cos(u.time * 0.33) * 0.32, sin(u.time * 0.41) * 0.30)), 2.0) * 5.0);
  let blob3 = exp(-pow(length(c - vec2<f32>(0.0, sin(u.time * 0.5) * 0.22)), 2.0) * 7.0);

  let oxygenCyan = vec3<f32>(0.02, 0.71, 0.83);
  let bioEmerald = vec3<f32>(0.06, 0.73, 0.51);
  let crispMint = vec3<f32>(0.18, 0.83, 0.75);
  let amberGold = vec3<f32>(0.96, 0.62, 0.04);
  let violet = vec3<f32>(0.55, 0.36, 0.96);
  let crimson = vec3<f32>(0.94, 0.27, 0.27);
  let magenta = vec3<f32>(0.93, 0.24, 0.60);

  var col = vec3<f32>(0.016, 0.035, 0.067); // abyssal slate #040911
  let energy = clamp(u.flow / 10.0, 0.0, 1.0);
  col += oxygenCyan * blob1 * (0.35 + energy * 0.9);
  col += bioEmerald * blob2 * (0.30 + energy * 0.8);
  col += crispMint * blob3 * (0.22 + energy * 0.6);
  col += u.zoneTint * bands * (0.10 + energy * 0.35);
  col += violet * blob2 * 0.12;
  col += crimson * blob1 * 0.10;
  col += magenta * bands * 0.06;

  // Specular fresnel rim (liquid glass edge).
  let fres = pow(1.0 - clamp(r * 1.6, 0.0, 1.0), 2.0);
  col += vec3<f32>(0.9, 0.97, 1.0) * fres * 0.22;

  // Low-GPU mode: quantize to flat 2D bands (cheap).
  if (u.lowGpu > 0.5) {
    col = floor(col * 8.0) / 8.0;
  }
  let alpha = 1.0;
  return vec4<f32>(col, alpha);
}
