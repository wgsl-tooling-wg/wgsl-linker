
export const wgslBundle = {
  "name": "random_wgsl",
  "version": "0.1.1",
  "edition": "wesl_unstable_2024_1",
  "modules": {
    "lib.wgsl": "// PCG pseudo random generator from vec2u to vec4f\n// the random output is in the range from zero to 1\nfn pcg_2u_3f(pos: vec3u) -> vec3f {\n    let seed = mix2to3(pos);\n    let random = pcg_3u_3u(seed);\n    let normalized = ldexp(vec3f(random), vec3(-32));\n    return vec3f(normalized);\n}\n\n// PCG random generator from vec3u to vec3u\n// adapted from http://www.jcgt.org/published/0009/03/02/\nfn pcg_3u_3u(seed: vec3u) -> vec3u {\n    var v = seed * 1664525u + 1013904223u;\n\n    v = mixing(v);\n    v ^= v >> vec3(16u);\n    v = mixing(v);\n\n    return v;\n}\n\n// permuted lcg \nfn mixing(v: vec3u) -> vec3u {\n    var m: vec3u = v;\n    m.x += v.y * v.z;\n    m.y += v.z * v.x;\n    m.z += v.x * v.y;\n\n    return m;\n}\n\n// mix position into a seed as per: https://www.shadertoy.com/view/XlGcRh\nfn mix2to3(p: vec2u) -> vec3u {\n    let seed = vec3u(\n        p.x,\n        p.x ^ p.y,\n        p.x + p.y,\n    );\n    return seed;\n}\n\n// from https://stackoverflow.com/questions/12964279/whats-the-origin-of-this-glsl-rand-one-liner\nfn sinRand(co: vec2f) -> f32 {\n  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);\n}"
  }
}

export default wgslBundle;
  