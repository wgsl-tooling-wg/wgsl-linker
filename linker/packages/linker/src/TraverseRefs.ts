import {
  AliasElem,
  FnElem,
  StructElem,
  StructMemberElem,
  TreeImportElem,
  VarElem
} from "./AbstractElems.js";
import { TextModule } from "./ParseModule.js";

/**
 * A wrapper around a wgsl element targeted for inclusion in the link
 * There is one FoundRef per unique target element.
 * . Multiple references to a single target element share the same FoundRef.
 * . But multiple versions of a target element from generic expansion
 *   result in multiple FoundRefs.
 */
export type FoundRef = TextRef;

export type StringPairs = [string, string][];

interface FoundRefBase {
  /** proposed name to use for this referent, either fn/struct name or 'as' name from the import.
   * name might still be rewritten by global uniqueness remapping */
  proposedName: string;

  /** rename needed for the referent element due to the global uniqueness mapping */
  rename?: string;
}

export interface ExportInfo {
  /** reference that led us to find this ref */
  fromRef: FoundRef;

  /** import or extends elem that resolved to this export (so we can later separate out extends) */
  fromImport: TreeImportElem;
}

/** A reference to a target wgsl element (e.g. a function). */
export interface TextRef extends FoundRefBase {
  kind: "txt";

  /** module containing the referenced element */
  expMod: TextModule;

  /** referenced element */
  elem: FnElem | StructElem | VarElem | AliasElem | StructMemberElem;

  /** extra data if the referenced element is from another module */
  expInfo?: ExportInfo;
}

export const stdFns = `bitcast all any select arrayLength 
  abs acos acosh asin asinh atan atanh atan2 ceil clamp cos cosh 
  countLeadingZeros countOneBits countTrailingZeros cross 
  degrees determinant distance dot dot4UI8Packed dot4I8Packed 
  exp exp2 extractBits faceForward firstLeadingBit firstTrailingBit 
  floor fma fract frexp inserBits inverseSqrt ldexp length log log2
  max min mix modf normalize pow quantizeToF16 radians reflect refract
  reverseBits round saturate sign sin sinh smoothstep sqrt step tan tanh
  transpose trunc
  dpdx dpdxCoarse dpdxFine dpdy dpdyCoarse dpdyFine fwidth 
  fwdithCoarse fwidthFine
  textureDimensions textureGather textureGatherCompare textureLoad
  textureNumLayers textureNumLevels textureNumSamples
  textureSample textureSampleBias textureSampleCompare textureSampleCompareLevel
  textureSampleGrad textureSampleLevel textureSampleBaseClampToEdge
  textureStore
  atomicLoad atomicStore atomicAdd atomicSub atomicMax atomicMin
  atomicOr atomicXor atomicExchange atomicCompareExchangeWeak
  pack4x8snorm pack4x8unorm pack4xI8 pack4xU8 pack4xI8Clamp pack4xU8Clamp
  pack2x16snorm pack2x16unorm pack2x16float
  unpack4x8snorm unpack4x8unorm unpack4xI8 unpack4xU8 
  unpack2x16snorm unpack2x16unorm unpack2x16float
  storageBarrier textureBarrier workgroupBarrier workgroupUniformLoad
  `.split(/\s+/);

export const stdTypes = `array atomic bool f16 f32 i32 
  mat2x2 mat2x3 mat2x4 mat3x2 mat3x3 mat3x4 mat4x2 mat4x3 mat4x4
  mat2x2f mat2x3f mat2x4f mat3x2f mat3x3f mat3x4f
  mat4x2f mat4x3f mat4x4f
  mat2x2h mat2x3h mat2x4h mat3x2h mat3x3h mat3x4h
  mat4x2h mat4x3h mat4x4h
  u32 vec2 vec3 vec4 ptr
  vec2i vec3i vec4i vec2u vec3u vec4u
  vec2f vec3f vec4f vec2h vec3h vec4h
  texture_1d texture_2d texture_2d_array texture_3d 
  texture_cube texture_cube_array
  texture_multisampled_2d texture_depth_multisampled_2d
  texture_external
  texture_storage_1d texture_storage_2d texture_storage_2d_array
  texture_storage_3d
  texture_depth_2d texture_depth_2d_array texture_depth_cube
  texture_depth_cube_array
  sampler sampler_comparison
  rgba8unorm rgba8snorm rgba8uint rgba8sint
  rgba16uint rgba16sint rgba16float 
  r32uint r32sint r32float rg32uint rg32sint rg32float
  rgba32uint rgba32sint rgba32float
  bgra8unorm 
  function uniform
  `.split(/\s+/); // LATER handle 'function' in template parser?

/* Note the texel formats like rgba8unorm are here because they appear in type position
 in <templates> for texture_storage_* types. 
 (We could parse texture_storage types specially, but user code is unlikely to alias 
  the texture format names with e.g. a 'struct rbga8unorm .)
*/

/** return true if the name is for a built in type (not a user struct) */
export function stdType(name: string): boolean {
  return stdTypes.includes(name);
}

export function refName(ref: FoundRef): string {
  return ref.elem.name;
}

/** return true if the name is for a built in fn (not a user function) */
export function stdFn(name: string): boolean {
  return stdFns.includes(name) || stdType(name);
}
