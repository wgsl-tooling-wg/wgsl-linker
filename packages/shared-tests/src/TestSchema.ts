export interface WgslTestSrc {
  name: string;                 // human readable description of test
  src: Record<string, string>;  // source wgsl+ texts, keys are file paths
  notes?: string;               // additional notes to test implementors
}