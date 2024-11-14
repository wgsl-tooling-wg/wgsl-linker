struct Input { 
    sum: f32,   
}

struct Output { 
    sum: f32,   
}

struct Uniforms {
    sourceOffset: u32,        // offset in Input elements to start reading in the source
    resultOffset: u32,        // offset in Output elements to start writing in the results
}

@group(0) @binding(0) var<uniform> u: Uniforms;                     
@group(0) @binding(1) var<storage, read> src: array<Input>; 
@group(0) @binding(2) var<storage, read_write> out: array<Output>;  
@group(0) @binding(11) var<storage, read_write> debug: array<f32>; // buffer to hold debug values

override workgroupThreads = 4u;                          

var <workgroup> work: array<Output, workgroupThreads>; 

// 
// reduce a buffer of values to a single value, returned as the last element of the out array
// 
// each dispatch does two reductions:
//    . each invocation reduces from a src buffer to the workgroup buffer
//    . one invocation per workgroup reduces from the workgroup buffer to the out buffer
// the driver issues multiple dispatches until the output is 1 element long
//    (subsequent passes uses the output of the previous pass as the src)
// the same output buffer can be used as input and output in subsequent passes
//    . start and end indices in the uniforms indicate input and output positions in the buffer
// 

@compute
@workgroup_size(workgroupThreads, 1, 1) 
fn main(
    @builtin(global_invocation_id) grid: vec3<u32>,    // coords in the global compute grid
    @builtin(local_invocation_index) localIndex: u32,  // index inside the this workgroup
    @builtin(num_workgroups) numWorkgroups: vec3<u32>, // number of workgroups in this dispatch
    @builtin(workgroup_id) workgroupId: vec3<u32>      // workgroup id in the dispatch
) {
    reduceBufferToWork(grid.xy, localIndex);
    let outDex = workgroupId.x + u.resultOffset;
    reduceWorkgroup(localIndex);
    if localIndex == 0u {
        out[outDex] = work[0];
    }
}

fn reduceBufferToWork(grid: vec2<u32>, localId: u32) {
    var values = fetchSrcBuffer(grid.x);
    var v = reduceSrcBlock(values);
    work[localId] = v;
}

fn fetchSrcBuffer(gridX: u32) -> array<Output, BlockArea> {
    let start = u.sourceOffset + (gridX * BlockArea);
    let end = arrayLength(&src);
    var a = array<Output, BlockArea>();
    for (var i = 0u; i < BlockArea; i = i + 1u) {
        var idx = i + start;
        if idx < end {
            a[i] = loadOp(src[idx]);
        } else {
            a[i] = identityOp();
        }
    }

    return a;
}

fn reduceSrcBlock(a: array<Output, BlockArea>) -> Output {
    var v = a[0];
    for (var i = 1u; i < BlockArea; i = i + 1u) {
        v = binaryOp(v, a[i]);
    }
    return v;
}