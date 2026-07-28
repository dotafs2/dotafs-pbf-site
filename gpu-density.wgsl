struct RenderParams {
  display: vec4<f32>,
  simulation: vec4<f32>,
  style: vec4<f32>,
  climate: vec4<f32>,
  vapor: vec4<f32>,
  cloud: vec4<f32>,
}

struct ParticleCorrection {
  vectors: vec4<f32>,
  glyphLifecycle: vec4<f32>,
}

@group(0) @binding(0) var<storage, read> positions: array<vec2<f32>>;
@group(0) @binding(1) var<uniform> params: RenderParams;
@group(0) @binding(2) var snowflakeTexture: texture_2d<f32>;
@group(0) @binding(3) var raindropTexture: texture_2d<f32>;
@group(0) @binding(4) var particleSampler: sampler;
@group(0) @binding(5) var<storage, read> corrections: array<ParticleCorrection>;
@group(0) @binding(6) var<storage, read> velocities: array<vec2<f32>>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) localPosition: vec2<f32>,
  @location(1) particlePosition: vec2<f32>,
  @location(2) @interpolate(flat) particleIndex: u32,
}

fn velocityAlignedOffset(
  localPosition: vec2<f32>,
  spriteScale: vec2<f32>,
  velocity: vec2<f32>,
) -> vec2<f32> {
  let speed = length(velocity);
  var direction = vec2<f32>(0.0, 1.0);
  if (speed > 2.0) {
    direction = velocity / speed;
  }
  let right = vec2<f32>(direction.y, -direction.x);
  let scaledLocal = localPosition * spriteScale;
  return
    right * scaledLocal.x +
    direction * scaledLocal.y;
}

fn rainPalette(
  particlePosition: vec2<f32>,
) -> vec3<f32> {
  let dayMix = smoothstep(
    params.simulation.x * 0.46,
    params.simulation.x * 0.54,
    particlePosition.x,
  );
  return mix(
    vec3<f32>(0.58, 0.88, 1.0),
    vec3<f32>(1.0, 0.46, 0.2),
    dayMix,
  );
}

fn particleVariation(
  particleIndex: u32,
  salt: f32,
) -> f32 {
  return fract(
    sin((f32(particleIndex) + salt) * 12.9898) *
    43758.5453
  );
}

fn snowAppearance(
  particleIndex: u32,
  localPosition: vec2<f32>,
  snowUv: vec2<f32>,
) -> vec4<f32> {
  let depth = particleVariation(particleIndex, 3.17);
  let crystalSeed = particleVariation(particleIndex, 9.41);
  let crystalWeight = smoothstep(0.82, 0.94, crystalSeed);
  let sprite = textureSampleLevel(
    snowflakeTexture,
    particleSampler,
    snowUv,
    0.0,
  );
  let softRadius = length(
    localPosition * vec2<f32>(0.88, 1.0)
  );
  let softCore =
    1.0 - smoothstep(0.12, 0.86, softRadius);
  let softHalo =
    1.0 - smoothstep(0.34, 1.0, softRadius);
  let softAlpha =
    (softCore * softCore * 0.78 + softHalo * 0.13);
  let crystalAlpha = sprite.a * 0.82;
  let depthAlpha = mix(0.3, 0.9, depth);
  let alpha = mix(
    softAlpha,
    crystalAlpha,
    crystalWeight,
  ) * depthAlpha;
  let softColor = mix(
    vec3<f32>(0.64, 0.74, 0.9),
    vec3<f32>(0.96, 0.98, 1.0),
    depth,
  );
  let crystalColor = mix(
    sprite.rgb,
    vec3<f32>(0.84, 0.94, 1.0),
    0.42,
  );
  return vec4<f32>(
    mix(softColor, crystalColor, crystalWeight),
    alpha,
  );
}

fn rainAppearance(
  particleIndex: u32,
  particlePosition: vec2<f32>,
  localPosition: vec2<f32>,
  rainUv: vec2<f32>,
) -> vec4<f32> {
  let depth = particleVariation(particleIndex, 5.73);
  let sprite = textureSampleLevel(
    raindropTexture,
    particleSampler,
    rainUv,
    0.0,
  );
  let streakRadius = length(
    localPosition * vec2<f32>(2.0, 0.9)
  );
  let glow =
    (1.0 - smoothstep(0.3, 1.0, streakRadius)) *
    0.24;
  let headGlow =
    (1.0 -
      smoothstep(
        0.08,
        0.48,
        length(
          localPosition - vec2<f32>(0.0, 0.38)
        ),
      )) *
    0.3;
  let depthAlpha = mix(0.52, 0.98, depth);
  let alpha =
    max(sprite.a * 0.94, glow + headGlow) *
    depthAlpha;
  let baseColor = rainPalette(particlePosition);
  let color = mix(
    baseColor,
    vec3<f32>(1.0, 0.9, 0.62),
    clamp(sprite.r * 0.36 + depth * 0.12, 0.0, 0.48),
  );
  return vec4<f32>(color, alpha);
}

@vertex
fn densityVertex(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
  );
  let localPosition = corners[vertexIndex];
  let pixelPosition =
    positions[instanceIndex] + localPosition * params.simulation.z;
  let clipPosition = vec2<f32>(
    pixelPosition.x / params.simulation.x * 2.0 - 1.0,
    1.0 - pixelPosition.y / params.simulation.y * 2.0,
  );

  var output: VertexOutput;
  output.position = vec4<f32>(clipPosition, 0.0, 1.0);
  output.localPosition = localPosition;
  output.particlePosition = positions[instanceIndex];
  output.particleIndex = instanceIndex;
  return output;
}

@vertex
fn rainVertex(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
  );
  let localPosition = corners[vertexIndex];
  let particlePosition = positions[instanceIndex];
  let snowBlend = clamp(
    corrections[instanceIndex].glyphLifecycle.w,
    0.0,
    1.0,
  );
  let rainDepth = particleVariation(instanceIndex, 5.73);
  let snowDepth = particleVariation(instanceIndex, 3.17);
  let crystalWeight = smoothstep(
    0.82,
    0.94,
    particleVariation(instanceIndex, 9.41),
  );
  let rainRadius =
    params.climate.w * mix(0.68, 1.16, rainDepth);
  let snowRadius =
    params.climate.w *
    mix(0.38, 0.88, snowDepth) *
    mix(1.0, 1.28, crystalWeight);
  let rainOffset = velocityAlignedOffset(
    localPosition,
    vec2<f32>(rainRadius * 0.52, rainRadius * 1.56),
    velocities[instanceIndex],
  );
  let snowOffset =
    localPosition * vec2<f32>(snowRadius);
  let spriteOffset = mix(
    rainOffset,
    snowOffset,
    snowBlend,
  );
  let pixelPosition =
    particlePosition + spriteOffset;
  let clipPosition = vec2<f32>(
    pixelPosition.x / params.simulation.x * 2.0 - 1.0,
    1.0 - pixelPosition.y / params.simulation.y * 2.0,
  );

  var output: VertexOutput;
  output.position = vec4<f32>(clipPosition, 0.0, 1.0);
  output.localPosition = localPosition;
  output.particlePosition = particlePosition;
  output.particleIndex = instanceIndex;
  return output;
}

@vertex
fn snowVertex(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
  );
  let localPosition = corners[vertexIndex];
  let particlePosition = positions[instanceIndex];
  let rainBlend = clamp(
    corrections[instanceIndex].glyphLifecycle.w,
    0.0,
    1.0,
  );
  let rainDepth = particleVariation(instanceIndex, 5.73);
  let snowDepth = particleVariation(instanceIndex, 3.17);
  let crystalWeight = smoothstep(
    0.82,
    0.94,
    particleVariation(instanceIndex, 9.41),
  );
  let snowRadius =
    params.climate.w *
    mix(0.38, 0.88, snowDepth) *
    mix(1.0, 1.28, crystalWeight);
  let rainRadius =
    params.climate.w * mix(0.68, 1.16, rainDepth);
  let snowOffset =
    localPosition * vec2<f32>(snowRadius);
  let rainOffset = velocityAlignedOffset(
    localPosition,
    vec2<f32>(rainRadius * 0.52, rainRadius * 1.56),
    velocities[instanceIndex],
  );
  let spriteOffset = mix(
    snowOffset,
    rainOffset,
    rainBlend,
  );
  let pixelPosition =
    particlePosition + spriteOffset;
  let clipPosition = vec2<f32>(
    pixelPosition.x / params.simulation.x * 2.0 - 1.0,
    1.0 - pixelPosition.y / params.simulation.y * 2.0,
  );

  var output: VertexOutput;
  output.position = vec4<f32>(clipPosition, 0.0, 1.0);
  output.localPosition = localPosition;
  output.particlePosition = particlePosition;
  output.particleIndex = instanceIndex;
  return output;
}

@vertex
fn cloudWeatherVertex(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
  );
  let localPosition = corners[vertexIndex];
  let particlePosition = positions[instanceIndex];
  let rainBlend = clamp(
    corrections[instanceIndex].glyphLifecycle.x,
    0.0,
    1.0,
  );
  let rainDepth = particleVariation(instanceIndex, 5.73);
  let snowDepth = particleVariation(instanceIndex, 3.17);
  let crystalWeight = smoothstep(
    0.82,
    0.94,
    particleVariation(instanceIndex, 9.41),
  );
  let rainRadius =
    params.climate.w * mix(0.68, 1.16, rainDepth);
  let snowRadius =
    params.climate.w *
    mix(0.38, 0.88, snowDepth) *
    mix(1.0, 1.28, crystalWeight);
  let snowOffset =
    localPosition * vec2<f32>(snowRadius);
  let rainOffset = velocityAlignedOffset(
    localPosition,
    vec2<f32>(rainRadius * 0.52, rainRadius * 1.56),
    velocities[instanceIndex],
  );
  let spriteOffset = mix(
    snowOffset,
    rainOffset,
    rainBlend,
  );
  let pixelPosition =
    particlePosition + spriteOffset;
  let clipPosition = vec2<f32>(
    pixelPosition.x / params.simulation.x * 2.0 - 1.0,
    1.0 - pixelPosition.y / params.simulation.y * 2.0,
  );

  var output: VertexOutput;
  output.position = vec4<f32>(clipPosition, 0.0, 1.0);
  output.localPosition = localPosition;
  output.particlePosition = particlePosition;
  output.particleIndex = instanceIndex;
  return output;
}

@vertex
fn vaporVertex(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
  );
  let localPosition = corners[vertexIndex];
  let particlePosition = positions[instanceIndex];
  let vaporRadius = params.simulation.z * 1.05;
  let pixelPosition =
    particlePosition +
    vec2<f32>(
      localPosition.x * vaporRadius * 0.76,
      localPosition.y * vaporRadius * 1.12,
    );
  let clipPosition = vec2<f32>(
    pixelPosition.x / params.simulation.x * 2.0 - 1.0,
    1.0 - pixelPosition.y / params.simulation.y * 2.0,
  );

  var output: VertexOutput;
  output.position = vec4<f32>(clipPosition, 0.0, 1.0);
  output.localPosition = localPosition;
  output.particlePosition = particlePosition;
  output.particleIndex = instanceIndex;
  return output;
}

@fragment
fn densityFragment(input: VertexOutput) -> @location(0) vec4<f32> {
  let rainStart = u32(params.style.z);
  let rainEnd = u32(params.style.w);
  if (
    input.particleIndex >= rainStart &&
    input.particleIndex < rainEnd &&
    input.particlePosition.y <
      params.climate.z
  ) {
    discard;
  }
  let snowStart = u32(params.climate.x);
  let snowEnd = u32(params.climate.y);
  if (
    input.particleIndex >= snowStart &&
    input.particleIndex < snowEnd &&
    input.particlePosition.y <
      params.climate.z
  ) {
    discard;
  }
  let vaporStart = u32(params.vapor.x);
  let vaporEnd = u32(params.vapor.y);
  if (
    input.particleIndex >= vaporStart &&
    input.particleIndex < vaporEnd
  ) {
    discard;
  }
  let cloudStart = u32(params.cloud.x);
  let cloudEnd = u32(params.cloud.y);
  if (
    input.particleIndex >= cloudStart &&
    input.particleIndex < cloudEnd &&
    corrections[input.particleIndex].glyphLifecycle.w > 0.0 &&
    input.particlePosition.y < params.climate.z
  ) {
    discard;
  }
  let radiusSquared = dot(input.localPosition, input.localPosition);
  if (radiusSquared >= 1.0) {
    discard;
  }
  let falloff = 1.0 - radiusSquared;
  let density = falloff * falloff * falloff * 0.72;
  return vec4<f32>(density, density, density, density);
}

@fragment
fn particleFragment(input: VertexOutput) -> @location(0) vec4<f32> {
  let rainStart = u32(params.style.z);
  let rainEnd = u32(params.style.w);
  let snowStart = u32(params.climate.x);
  let snowEnd = u32(params.climate.y);
  let vaporStart = u32(params.vapor.x);
  let vaporEnd = u32(params.vapor.y);
  let cloudStart = u32(params.cloud.x);
  let cloudEnd = u32(params.cloud.y);
  let releasedCloud =
    input.particleIndex >= cloudStart &&
    input.particleIndex < cloudEnd &&
    corrections[input.particleIndex].glyphLifecycle.w > 0.0;
  let poolSurface = params.climate.z;
  if (
    (
      input.particleIndex >= rainStart &&
      input.particleIndex < rainEnd &&
      input.particlePosition.y < poolSurface
    ) ||
    (
      input.particleIndex >= snowStart &&
      input.particleIndex < snowEnd &&
      input.particlePosition.y < poolSurface
    ) ||
    (
      input.particleIndex >= vaporStart &&
      input.particleIndex < vaporEnd
    ) ||
    releasedCloud
  ) {
    discard;
  }
  let radiusSquared = dot(input.localPosition, input.localPosition);
  if (radiusSquared >= 1.0) {
    discard;
  }
  let falloff = 1.0 - radiusSquared;
  let alpha = smoothstep(0.0, 0.72, falloff);
  var color = mix(
    vec3<f32>(0.01, 0.24, 0.48),
    vec3<f32>(0.22, 0.82, 1.0),
    falloff,
  );
  if (
    input.particleIndex >= cloudStart &&
    input.particleIndex < cloudEnd
  ) {
    color = mix(
      vec3<f32>(0.28, 0.56, 0.72),
      vec3<f32>(0.82, 0.96, 1.0),
      falloff,
    );
  }
  return vec4<f32>(color, alpha * 0.86);
}

@fragment
fn rainFragment(input: VertexOutput) -> @location(0) vec4<f32> {
  if (
    input.particlePosition.y >=
    params.climate.z
  ) {
    discard;
  }
  let snowBlend = clamp(
    corrections[input.particleIndex].glyphLifecycle.w,
    0.0,
    1.0,
  );
  let rainUv = vec2<f32>(
    input.localPosition.x * 0.25 + 0.5,
    input.localPosition.y * 0.5 + 0.5,
  );
  let spin =
    f32(input.particleIndex) * 2.399963 +
    input.particlePosition.y * 0.006;
  let cosine = cos(spin);
  let sine = sin(spin);
  let snowLocal = vec2<f32>(
    input.localPosition.x * cosine -
      input.localPosition.y * sine,
    input.localPosition.x * sine +
      input.localPosition.y * cosine,
  );
  let snowUv =
    snowLocal * 0.5 + vec2<f32>(0.5);
  let rainLook = rainAppearance(
    input.particleIndex,
    input.particlePosition,
    input.localPosition,
    rainUv,
  );
  let snowLook = snowAppearance(
    input.particleIndex,
    snowLocal,
    snowUv,
  );
  let rainColor = rainLook.rgb;
  let snowColor = snowLook.rgb;
  let rainAlpha = rainLook.a;
  let snowAlpha = snowLook.a;
  let alpha = mix(rainAlpha, snowAlpha, snowBlend);
  if (alpha < 0.015) {
    discard;
  }
  let premultipliedColor = mix(
    rainColor * rainAlpha,
    snowColor * snowAlpha,
    snowBlend,
  );
  return vec4<f32>(
    premultipliedColor / max(alpha, 0.001),
    alpha,
  );
}

@fragment
fn snowFragment(input: VertexOutput) -> @location(0) vec4<f32> {
  if (input.particlePosition.y >= params.climate.z) {
    discard;
  }
  let rainBlend = clamp(
    corrections[input.particleIndex].glyphLifecycle.w,
    0.0,
    1.0,
  );
  let rainUv = vec2<f32>(
    input.localPosition.x * 0.25 + 0.5,
    input.localPosition.y * 0.5 + 0.5,
  );
  let spin =
    f32(input.particleIndex) * 2.399963 +
    input.particlePosition.y * 0.006;
  let cosine = cos(spin);
  let sine = sin(spin);
  let local = vec2<f32>(
    input.localPosition.x * cosine -
      input.localPosition.y * sine,
    input.localPosition.x * sine +
      input.localPosition.y * cosine,
  );
  let snowUv = local * 0.5 + vec2<f32>(0.5);
  let snowLook = snowAppearance(
    input.particleIndex,
    local,
    snowUv,
  );
  let rainLook = rainAppearance(
    input.particleIndex,
    input.particlePosition,
    input.localPosition,
    rainUv,
  );
  let snowColor = snowLook.rgb;
  let rainColor = rainLook.rgb;
  let snowAlpha = snowLook.a;
  let rainAlpha = rainLook.a;
  let alpha = mix(snowAlpha, rainAlpha, rainBlend);
  if (alpha < 0.015) {
    discard;
  }
  let premultipliedColor = mix(
    snowColor * snowAlpha,
    rainColor * rainAlpha,
    rainBlend,
  );
  return vec4<f32>(
    premultipliedColor / max(alpha, 0.001),
    alpha,
  );
}

@fragment
fn cloudWeatherFragment(
  input: VertexOutput,
) -> @location(0) vec4<f32> {
  let releaseAge =
    corrections[input.particleIndex].glyphLifecycle.w;
  if (
    releaseAge <= 0.0 ||
    input.particlePosition.y >= params.climate.z
  ) {
    discard;
  }
  let rainBlend = clamp(
    corrections[input.particleIndex].glyphLifecycle.x,
    0.0,
    1.0,
  );
  let rainUv = vec2<f32>(
    input.localPosition.x * 0.25 + 0.5,
    input.localPosition.y * 0.5 + 0.5,
  );
  let spin =
    f32(input.particleIndex) * 2.399963 +
    input.particlePosition.y * 0.006;
  let cosine = cos(spin);
  let sine = sin(spin);
  let snowLocal = vec2<f32>(
    input.localPosition.x * cosine -
      input.localPosition.y * sine,
    input.localPosition.x * sine +
      input.localPosition.y * cosine,
  );
  let snowUv =
    snowLocal * 0.5 + vec2<f32>(0.5);
  let rainLook = rainAppearance(
    input.particleIndex,
    input.particlePosition,
    input.localPosition,
    rainUv,
  );
  let snowLook = snowAppearance(
    input.particleIndex,
    snowLocal,
    snowUv,
  );
  let rainColor = rainLook.rgb;
  let snowColor = snowLook.rgb;
  let rainAlpha = rainLook.a;
  let snowAlpha = snowLook.a;
  let alpha = mix(snowAlpha, rainAlpha, rainBlend);
  if (alpha < 0.015) {
    discard;
  }
  let premultipliedColor = mix(
    snowColor * snowAlpha,
    rainColor * rainAlpha,
    rainBlend,
  );
  return vec4<f32>(
    premultipliedColor / max(alpha, 0.001),
    alpha,
  );
}

@fragment
fn vaporFragment(input: VertexOutput) -> @location(0) vec4<f32> {
  let local = input.localPosition;
  let radius = length(local);
  if (radius >= 1.0) {
    discard;
  }
  let lowerPuff =
    1.0 -
    smoothstep(
      0.28,
      0.86,
      length(local - vec2<f32>(-0.16, 0.15)),
    );
  let upperPuff =
    1.0 -
    smoothstep(
      0.2,
      0.72,
      length(local - vec2<f32>(0.2, -0.22)),
    );
  let core =
    1.0 - smoothstep(0.0, 0.62, radius);
  let heightProgress = clamp(
    (params.climate.z - input.particlePosition.y) /
      max(1.0, params.climate.z - params.vapor.z),
    0.0,
    1.0,
  );
  let lifecycleFade =
    smoothstep(0.0, 0.08, heightProgress) *
    (1.0 - smoothstep(0.88, 1.0, heightProgress));
  let dayMix = smoothstep(
    params.simulation.x * 0.46,
    params.simulation.x * 0.54,
    input.particlePosition.x,
  );
  let alpha =
    max(max(lowerPuff, upperPuff), core) *
    mix(0.32, 0.16, dayMix) *
    lifecycleFade;
  let color = mix(
    mix(
      vec3<f32>(0.34, 0.58, 0.88),
      vec3<f32>(0.82, 0.38, 0.34),
      dayMix,
    ),
    mix(
      vec3<f32>(0.78, 0.92, 1.0),
      vec3<f32>(1.0, 0.8, 0.54),
      dayMix,
    ),
    core,
  );
  return vec4<f32>(color, alpha);
}
