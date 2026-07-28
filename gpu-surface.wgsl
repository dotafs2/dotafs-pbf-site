struct RenderParams {
  display: vec4<f32>,
  simulation: vec4<f32>,
  style: vec4<f32>,
  climate: vec4<f32>,
  vapor: vec4<f32>,
  cloud: vec4<f32>,
}

@group(0) @binding(0) var<uniform> params: RenderParams;
@group(0) @binding(1) var densityTexture: texture_2d<f32>;
@group(0) @binding(2) var densitySampler: sampler;

@vertex
fn fullscreenVertex(@builtin(vertex_index) vertexIndex: u32)
  -> @builtin(position) vec4<f32> {
  let positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );
  return vec4<f32>(positions[vertexIndex], 0.0, 1.0);
}

@fragment
fn surfaceFragment(@builtin(position) fragmentPosition: vec4<f32>)
  -> @location(0) vec4<f32> {
  let uv = fragmentPosition.xy / params.display.xy;
  let density = textureSampleLevel(
    densityTexture,
    densitySampler,
    uv,
    0.0,
  ).r;
  let dayMix = smoothstep(0.46, 0.54, uv.x);
  let depthColor = mix(
    vec3<f32>(0.035, 0.085, 0.3),
    vec3<f32>(0.22, 0.07, 0.2),
    dayMix,
  );
  let shallowColor = mix(
    vec3<f32>(0.18, 0.58, 0.88),
    vec3<f32>(0.86, 0.3, 0.3),
    dayMix,
  );
  let verticalColor = mix(
    shallowColor,
    depthColor,
    smoothstep(0.15, 1.0, uv.y),
  );
  let worldY = uv.y * params.simulation.y;
  let cloudRegion =
    1.0 -
    smoothstep(
      params.cloud.z + params.cloud.w * 0.05,
      params.cloud.z + params.cloud.w * 0.3,
      worldY,
    );
  let cloudLight = mix(
    vec3<f32>(0.76, 0.88, 1.0),
    vec3<f32>(1.0, 0.84, 0.58),
    dayMix,
  );
  let cloudShadow = mix(
    vec3<f32>(0.2, 0.33, 0.6),
    vec3<f32>(0.58, 0.25, 0.37),
    dayMix,
  );
  let cloudColor = mix(
    cloudLight,
    cloudShadow,
    smoothstep(
      params.cloud.z - params.cloud.w,
      params.cloud.z,
      worldY,
    ),
  );
  let materialColor = mix(
    verticalColor,
    cloudColor,
    cloudRegion,
  );
  let lowerSurfaceLimit =
    params.style.x - params.style.y * 3.0;
  if (density <= lowerSurfaceLimit) {
    return vec4<f32>(0.0);
  }

  let upperSurfaceLimit =
    params.style.x + params.style.y * 5.0;
  if (density >= upperSurfaceLimit) {
    return vec4<f32>(materialColor * 0.9, 1.0);
  }

  let texel = 1.0 / params.display.zw;
  let densityLeft = textureSampleLevel(
    densityTexture,
    densitySampler,
    uv - vec2<f32>(texel.x, 0.0),
    0.0,
  ).r;
  let densityRight = textureSampleLevel(
    densityTexture,
    densitySampler,
    uv + vec2<f32>(texel.x, 0.0),
    0.0,
  ).r;
  let densityTop = textureSampleLevel(
    densityTexture,
    densitySampler,
    uv - vec2<f32>(0.0, texel.y),
    0.0,
  ).r;
  let densityBottom = textureSampleLevel(
    densityTexture,
    densitySampler,
    uv + vec2<f32>(0.0, texel.y),
    0.0,
  ).r;
  let gradient = vec2<f32>(
    densityRight - densityLeft,
    densityBottom - densityTop,
  );
  let normal = normalize(vec3<f32>(-gradient * 7.0, 1.0));
  let lightDirection = normalize(vec3<f32>(-0.35, -0.55, 0.82));
  let diffuse = max(dot(normal, lightDirection), 0.0);
  let specular = pow(max(dot(normal, lightDirection), 0.0), 24.0);
  let waterMask = smoothstep(
    params.style.x - params.style.y,
    params.style.x + params.style.y,
    density,
  );
  let distanceFromSurface = abs(density - params.style.x);
  let surfaceBand =
    1.0 - smoothstep(params.style.y * 1.2, params.style.y * 5.0, distanceFromSurface);
  let surfaceLight =
    diffuse * 0.16 * surfaceBand +
    specular * 0.72 * surfaceBand;
  let edgeGlow =
    smoothstep(0.015, 0.14, length(gradient)) *
    surfaceBand *
    waterMask;
  let waterEdge = mix(
    vec3<f32>(0.42, 0.78, 1.0),
    vec3<f32>(1.0, 0.58, 0.37),
    dayMix,
  );
  let cloudEdge = mix(
    vec3<f32>(0.76, 0.92, 1.0),
    vec3<f32>(1.0, 0.9, 0.66),
    dayMix,
  );
  let edgeColor = mix(
    waterEdge,
    cloudEdge,
    cloudRegion,
  );
  let materialSurfaceColor =
    materialColor * (0.86 + surfaceLight) +
    edgeColor * edgeGlow;
  return vec4<f32>(
    materialSurfaceColor * waterMask,
    waterMask,
  );
}
