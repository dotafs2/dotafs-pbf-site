struct Params {
  viewport: vec4<f32>,
  simulation: vec4<f32>,
  grid: vec4<f32>,
  pointer: vec4<f32>,
  interaction: vec4<f32>,
  motion: vec4<f32>,
  lifecycle: vec4<f32>,
  weather: vec4<f32>,
  climate: vec4<f32>,
  vapor: vec4<f32>,
  cloud: vec4<f32>,
  cloudLayout: vec4<f32>,
  boat: vec4<f32>,
  boatShape: vec4<f32>,
}

struct ParticleCorrection {
  vectors: vec4<f32>,
  glyphLifecycle: vec4<f32>,
}

@group(0) @binding(0) var<storage, read_write> positions: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read_write> previousPositions: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read_write> lambdas: array<f32>;
@group(0) @binding(4) var<storage, read_write> corrections: array<ParticleCorrection>;
@group(0) @binding(5) var<storage, read_write> gridHeads: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> gridNext: array<u32>;
@group(0) @binding(7) var<storage, read_write> smoothedVelocities: array<vec2<f32>>;
@group(0) @binding(8) var<uniform> params: Params;

const PI: f32 = 3.141592653589793;
const GLYPH_STATE_THRESHOLD: f32 = -5e19;
const CORE_STATE_THRESHOLD: f32 = -1.5e20;
const ATTACHED_STATE: f32 = -1e20;
const RAIN_CYCLE_SECONDS: f32 = 3.1;
const SNOW_CYCLE_SECONDS: f32 = 9.2;
const WEATHER_MORPH_SECONDS: f32 = 0.46;
const CLOUD_RELEASE_SECONDS: f32 = 5.4;
const GLYPH_SEGMENTS = array<vec4<f32>, 27>(
  vec4<f32>(0.05, 0.05, 0.05, 0.95),
  vec4<f32>(0.05, 0.05, 0.45, 0.05),
  vec4<f32>(0.45, 0.05, 0.67, 0.24),
  vec4<f32>(0.67, 0.24, 0.67, 0.76),
  vec4<f32>(0.67, 0.76, 0.45, 0.95),
  vec4<f32>(0.45, 0.95, 0.05, 0.95),
  vec4<f32>(0.98, 0.24, 0.98, 0.76),
  vec4<f32>(0.98, 0.24, 1.20, 0.05),
  vec4<f32>(1.20, 0.05, 1.42, 0.05),
  vec4<f32>(1.42, 0.05, 1.64, 0.24),
  vec4<f32>(1.64, 0.24, 1.64, 0.76),
  vec4<f32>(1.64, 0.76, 1.42, 0.95),
  vec4<f32>(1.42, 0.95, 1.20, 0.95),
  vec4<f32>(1.20, 0.95, 0.98, 0.76),
  vec4<f32>(1.89, 0.05, 2.55, 0.05),
  vec4<f32>(2.22, 0.05, 2.22, 0.95),
  vec4<f32>(2.82, 0.95, 3.14, 0.05),
  vec4<f32>(3.14, 0.05, 3.46, 0.95),
  vec4<f32>(2.93, 0.60, 3.35, 0.60),
  vec4<f32>(3.77, 0.05, 3.77, 0.95),
  vec4<f32>(3.77, 0.05, 4.38, 0.05),
  vec4<f32>(3.77, 0.50, 4.24, 0.50),
  vec4<f32>(5.32, 0.12, 4.78, 0.05),
  vec4<f32>(4.78, 0.05, 4.67, 0.43),
  vec4<f32>(4.67, 0.43, 5.22, 0.55),
  vec4<f32>(5.22, 0.55, 5.32, 0.88),
  vec4<f32>(5.32, 0.88, 4.70, 0.95),
);

struct GlyphAttachmentQuery {
  baseTarget: vec2<f32>,
  animatedTarget: vec2<f32>,
  distance: f32,
}

struct BoatContact {
  normal: vec2<f32>,
  influence: f32,
}

fn isGlyphParticle(state: f32) -> bool {
  return state < GLYPH_STATE_THRESHOLD;
}

fn isCoreParticle(state: f32) -> bool {
  return state < CORE_STATE_THRESHOLD;
}

fn isOriginalGlyphParticle(index: u32) -> bool {
  return f32(index) >= params.lifecycle.x;
}

fn isRainParticle(index: u32) -> bool {
  let rainStart = u32(params.weather.x);
  let rainEnd = rainStart + u32(params.weather.y);
  return index >= rainStart && index < rainEnd;
}

fn isSnowParticle(index: u32) -> bool {
  let snowStart = u32(params.climate.x);
  let snowEnd = snowStart + u32(params.climate.y);
  return index >= snowStart && index < snowEnd;
}

fn isSnowConvertedToRain(index: u32) -> bool {
  return
    isSnowParticle(index) &&
    corrections[index].glyphLifecycle.w > 0.5;
}

fn isRainConvertedToSnow(index: u32) -> bool {
  return
    isRainParticle(index) &&
    corrections[index].glyphLifecycle.w > 0.5;
}

fn isRainLikeParticle(index: u32) -> bool {
  return
    (
      isRainParticle(index) &&
      !isRainConvertedToSnow(index)
    ) ||
    isSnowConvertedToRain(index);
}

fn isSnowLikeParticle(index: u32) -> bool {
  return
    (
      isSnowParticle(index) &&
      !isSnowConvertedToRain(index)
    ) ||
    isRainConvertedToSnow(index);
}

fn isFreeFallingPrecipitation(index: u32) -> bool {
  return
    (
      isSnowLikeParticle(index) ||
      isRainLikeParticle(index)
    ) &&
    positions[index].y < params.viewport.y * 0.795;
}

fn isVaporParticle(index: u32) -> bool {
  let vaporStart = u32(params.vapor.x);
  let vaporEnd = vaporStart + u32(params.vapor.y);
  return index >= vaporStart && index < vaporEnd;
}

fn isCloudParticle(index: u32) -> bool {
  let cloudStart = u32(params.cloud.x);
  let cloudEnd = cloudStart + u32(params.cloud.y);
  return index >= cloudStart && index < cloudEnd;
}

fn addCloudMoisture(side: u32) {
  let moistureIndex =
    u32(params.grid.x) * u32(params.grid.y) + side;
  loop {
    let current = atomicLoad(&gridHeads[moistureIndex]);
    let maximum = u32(params.cloud.w);
    if (current >= maximum) {
      return;
    }
    let result = atomicCompareExchangeWeak(
      &gridHeads[moistureIndex],
      current,
      current + 1u,
    );
    if (result.exchanged) {
      return;
    }
  }
}

fn consumeCloudMoisture(side: u32) {
  let moistureIndex =
    u32(params.grid.x) * u32(params.grid.y) + side;
  loop {
    let current = atomicLoad(&gridHeads[moistureIndex]);
    let minimum = u32(params.cloud.z);
    if (current <= minimum) {
      return;
    }
    let result = atomicCompareExchangeWeak(
      &gridHeads[moistureIndex],
      current,
      current - 1u,
    );
    if (result.exchanged) {
      return;
    }
  }
}

fn glyphHeight() -> f32 {
  let baseHeight = max(
    48.0,
    min(params.viewport.y * 0.11, params.viewport.x / 6.4),
  );
  return min(
    baseHeight * 1.5,
    min(params.viewport.x / 5.65, params.viewport.y * 0.18),
  );
}

fn glyphOrigin(height: f32) -> vec2<f32> {
  return vec2<f32>(
    (params.viewport.x - height * 5.38) * 0.5,
    params.viewport.y * 0.58 - height * 0.5,
  );
}

fn glyphLetterIndex(
  baseTarget: vec2<f32>,
  height: f32,
  origin: vec2<f32>,
) -> f32 {
  return clamp(
    floor(
      (baseTarget.x - origin.x) /
      (height * 0.93),
    ),
    0.0,
    5.0,
  );
}

fn animatedGlyphTarget(baseTarget: vec2<f32>) -> vec2<f32> {
  let height = glyphHeight();
  let origin = glyphOrigin(height);
  let letterIndex = glyphLetterIndex(
    baseTarget,
    height,
    origin,
  );
  let letterPhase = letterIndex * 0.83;
  let letterCenter = origin + vec2<f32>(
    (letterIndex * 0.93 + 0.35) * height,
    height * 0.5,
  );
  let alternatingDirection = select(
    1.0,
    -1.0,
    u32(letterIndex) % 2u == 1u,
  );
  let rotation = (
    sin(params.motion.x * 0.52 + letterPhase * 0.73) *
      0.08 +
    alternatingDirection *
      sin(params.motion.x * 0.28 + letterPhase) *
      0.022
  );
  let cosine = cos(rotation);
  let sine = sin(rotation);
  let localTarget = baseTarget - letterCenter;
  let rotatedTarget = vec2<f32>(
    localTarget.x * cosine - localTarget.y * sine,
    localTarget.x * sine + localTarget.y * cosine,
  );
  let horizontalSway = (
    sin(
      params.motion.x * params.motion.z +
      letterPhase
    ) +
    sin(
      params.motion.x * 0.43 +
      letterPhase * 0.61
    ) * 0.32
  ) * params.motion.y * 0.504;
  let verticalBob =
    sin(
      params.motion.x * params.motion.w +
      letterPhase * 1.17
    ) *
    params.motion.y *
    0.16;
  return letterCenter +
    rotatedTarget +
    vec2<f32>(horizontalSway, verticalBob);
}

fn queryGlyphAttachment(
  position: vec2<f32>,
) -> GlyphAttachmentQuery {
  let height = glyphHeight();
  let origin = glyphOrigin(height);
  let wordSize = vec2<f32>(height * 5.38, height);
  if (
    position.x < origin.x - height * 0.25 ||
    position.x > origin.x + wordSize.x + height * 0.25 ||
    position.y < origin.y - height * 0.25 ||
    position.y > origin.y + wordSize.y + height * 0.25
  ) {
    return GlyphAttachmentQuery(
      vec2<f32>(0.0),
      vec2<f32>(0.0),
      10000.0,
    );
  }

  var closestDistance = 10000.0;
  var closestBaseTarget = vec2<f32>(0.0);
  var closestAnimatedTarget = vec2<f32>(0.0);
  for (
    var segmentIndex = 0u;
    segmentIndex < 27u;
    segmentIndex = segmentIndex + 1u
  ) {
    let segment = GLYPH_SEGMENTS[segmentIndex];
    let baseStart = origin + segment.xy * height;
    let baseEnd = origin + segment.zw * height;
    let animatedStart = animatedGlyphTarget(baseStart);
    let animatedEnd = animatedGlyphTarget(baseEnd);
    let axis = animatedEnd - animatedStart;
    let axisLengthSquared = max(dot(axis, axis), 0.0001);
    let amount = clamp(
      dot(position - animatedStart, axis) /
      axisLengthSquared,
      0.0,
      1.0,
    );
    let animatedTarget = animatedStart + axis * amount;
    let distance = length(position - animatedTarget);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestBaseTarget = mix(baseStart, baseEnd, amount);
      closestAnimatedTarget = animatedTarget;
    }
  }
  return GlyphAttachmentQuery(
    closestBaseTarget,
    closestAnimatedTarget,
    closestDistance,
  );
}

fn particleCount() -> u32 {
  return u32(params.simulation.z);
}

fn smoothingRadius() -> f32 {
  return params.viewport.z;
}

fn poly6Kernel(radiusSquared: f32) -> f32 {
  let h = smoothingRadius();
  let h2 = h * h;
  if (radiusSquared <= 0.0 || radiusSquared >= h2) {
    return 0.0;
  }
  let difference = h2 - radiusSquared;
  let h4 = h2 * h2;
  let h8 = h4 * h4;
  return (4.0 / (PI * h8)) * difference * difference * difference;
}

fn spikyGradient(radius: vec2<f32>) -> vec2<f32> {
  let distance = length(radius);
  let h = smoothingRadius();
  if (distance <= 0.0001 || distance >= h) {
    return vec2<f32>(0.0);
  }
  let h2 = h * h;
  let h5 = h2 * h2 * h;
  let difference = h - distance;
  let scale = (-30.0 / (PI * h5)) * difference * difference / distance;
  return radius * scale;
}

fn cellCoordinates(position: vec2<f32>) -> vec2<i32> {
  let cell = vec2<i32>(floor(position / smoothingRadius()));
  return vec2<i32>(
    clamp(cell.x, 0, i32(params.grid.x) - 1),
    clamp(cell.y, 0, i32(params.grid.y) - 1),
  );
}

fn cellIndex(cell: vec2<i32>) -> u32 {
  return u32(cell.y) * u32(params.grid.x) + u32(cell.x);
}

fn projectBoundary(position: vec2<f32>) -> vec2<f32> {
  let padding = params.interaction.w;
  return clamp(
    position,
    vec2<f32>(padding),
    params.viewport.xy - vec2<f32>(padding),
  );
}

fn driftingCloudOffset(
  phase: f32,
  amplitude: f32,
) -> vec2<f32> {
  let time = params.motion.x;
  return vec2<f32>(
    sin(time * 0.075 + phase) * amplitude,
    sin(time * 0.11 + phase * 1.71) *
      amplitude *
      0.24,
  );
}

fn ellipseBoatContact(
  localPosition: vec2<f32>,
  center: vec2<f32>,
  radii: vec2<f32>,
) -> BoatContact {
  let offset = localPosition - center;
  let normalizedOffset = offset / radii;
  let normalizedDistance = length(normalizedOffset);
  let influence =
    1.0 - smoothstep(0.72, 1.18, normalizedDistance);
  var normal = vec2<f32>(0.0, 1.0);
  let gradient = vec2<f32>(
    offset.x / (radii.x * radii.x),
    offset.y / (radii.y * radii.y),
  );
  if (length(gradient) > 0.0001) {
    normal = normalize(gradient);
  }
  return BoatContact(normal, influence);
}

fn applyBoatInteraction(
  position: vec2<f32>,
  velocity: vec2<f32>,
) -> vec2<f32> {
  let halfWidth = params.boatShape.x;
  let hullHalfHeight = params.boatShape.y;
  if (halfWidth <= 0.0 || hullHalfHeight <= 0.0) {
    return velocity;
  }

  let relative = position - params.boat.xy;
  let broadRadius =
    halfWidth * 1.65 + hullHalfHeight * 2.2;
  if (dot(relative, relative) > broadRadius * broadRadius) {
    return velocity;
  }

  let angle = params.boatShape.z;
  let cosine = cos(angle);
  let sine = sin(angle);
  let localPosition = vec2<f32>(
    relative.x * cosine + relative.y * sine,
    -relative.x * sine + relative.y * cosine,
  );
  let hullContact = ellipseBoatContact(
    localPosition,
    vec2<f32>(0.0, -hullHalfHeight * 0.42),
    vec2<f32>(halfWidth, hullHalfHeight),
  );
  let sailContact = ellipseBoatContact(
    localPosition,
    vec2<f32>(0.0, -hullHalfHeight * 2.72),
    vec2<f32>(
      halfWidth * 0.58,
      hullHalfHeight * 2.18,
    ),
  );
  var contact = hullContact;
  if (sailContact.influence > contact.influence) {
    contact = sailContact;
  }
  if (contact.influence <= 0.0) {
    return velocity;
  }

  let worldNormal = vec2<f32>(
    contact.normal.x * cosine -
      contact.normal.y * sine,
    contact.normal.x * sine +
      contact.normal.y * cosine,
  );
  let angularVelocity = params.boatShape.w;
  let surfaceVelocity =
    params.boat.zw +
    vec2<f32>(
      -angularVelocity * relative.y,
      angularVelocity * relative.x,
    );
  let response =
    (
      1.0 -
      exp(
        -params.viewport.w *
          (8.0 + contact.influence * 18.0)
      )
    ) *
    contact.influence *
    0.78;
  var result = mix(velocity, surfaceVelocity, response);
  let inwardSpeed =
    dot(result - surfaceVelocity, worldNormal);
  if (inwardSpeed < 0.0) {
    result -= worldNormal * inwardSpeed * 0.92;
  }
  result +=
    worldNormal *
    (220.0 + contact.influence * 1680.0) *
    params.viewport.w *
    contact.influence;
  let speed = length(result);
  if (speed > params.grid.w) {
    result *= params.grid.w / speed;
  }
  return result;
}

fn weatherImpactAtGlyph(
  glyphPosition: vec2<f32>,
  weatherIndex: u32,
) -> vec2<f32> {
  let weatherPosition = positions[weatherIndex];
  if (weatherPosition.y >= params.viewport.y * 0.795) {
    return vec2<f32>(0.0);
  }
  let releasedCloud =
    isCloudParticle(weatherIndex) &&
    corrections[weatherIndex].glyphLifecycle.w > 0.0;
  let cloudRainBlend = clamp(
    corrections[weatherIndex].glyphLifecycle.x,
    0.0,
    1.0,
  );
  let rainLike =
    isRainLikeParticle(weatherIndex) ||
    (releasedCloud && cloudRainBlend >= 0.5);
  let snowLike =
    isSnowLikeParticle(weatherIndex) ||
    (releasedCloud && cloudRainBlend < 0.5);
  if (!rainLike && !snowLike) {
    return vec2<f32>(0.0);
  }
  let weatherVelocity = velocities[weatherIndex];
  let minimumFallSpeed = select(6.0, 18.0, rainLike);
  if (weatherVelocity.y <= minimumFallSpeed) {
    return vec2<f32>(0.0);
  }
  let offset = glyphPosition - weatherPosition;
  let distance = length(offset);
  let contactDistance = length(
    offset * vec2<f32>(
      1.0,
      select(0.84, 0.54, rainLike),
    ),
  );
  let impactRadius = select(
    max(14.0, smoothingRadius() * 1.04),
    max(16.0, smoothingRadius() * 1.24),
    rainLike,
  );
  if (contactDistance >= impactRadius) {
    return vec2<f32>(0.0);
  }
  let falloff =
    1.0 - contactDistance / impactRadius;
  let weightedFalloff = falloff * sqrt(falloff);
  var normal = vec2<f32>(0.0, 1.0);
  if (distance > 0.001) {
    normal = offset / distance;
  }
  if (rainLike) {
    return vec2<f32>(
      weatherVelocity.x * 0.055 + normal.x * 7.5,
      min(15.0, 2.6 + weatherVelocity.y * 0.064),
    ) * weightedFalloff;
  }
  return vec2<f32>(
    weatherVelocity.x * 0.05 + normal.x * 3.4,
    min(4.8, 0.8 + weatherVelocity.y * 0.038),
  ) * weightedFalloff;
}

fn glyphWeatherImpact(
  glyphPosition: vec2<f32>,
) -> vec2<f32> {
  var impact = vec2<f32>(0.0);
  let rainStart = u32(params.weather.x);
  let rainCount = u32(params.weather.y);
  for (
    var localIndex = 0u;
    localIndex < rainCount;
    localIndex = localIndex + 1u
  ) {
    let rainIndex = rainStart + localIndex;
    impact += weatherImpactAtGlyph(
      glyphPosition,
      rainIndex,
    );
  }

  let snowStart = u32(params.climate.x);
  let snowCount = u32(params.climate.y);
  for (
    var localIndex = 0u;
    localIndex < snowCount;
    localIndex = localIndex + 1u
  ) {
    let snowIndex = snowStart + localIndex;
    impact += weatherImpactAtGlyph(
      glyphPosition,
      snowIndex,
    );
  }

  let cloudStart = u32(params.cloud.x);
  let cloudCount = u32(params.cloud.y);
  for (
    var localIndex = 0u;
    localIndex < cloudCount;
    localIndex = localIndex + 1u
  ) {
    impact += weatherImpactAtGlyph(
      glyphPosition,
      cloudStart + localIndex,
    );
  }

  let impactLength = length(impact);
  if (impactLength > 18.0) {
    impact *= 18.0 / impactLength;
  }
  return impact;
}

@compute @workgroup_size(128)
fn integrate(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let index = invocation.x;
  if (index >= particleCount()) {
    return;
  }

  let dt = params.viewport.w;
  var position = positions[index];
  var velocity = velocities[index];
  previousPositions[index] = position;

  if (isCloudParticle(index)) {
    let cloudIndex =
      u32(f32(index) - params.cloud.x);
    let cloudCount = u32(params.cloud.y);
    let perCloudCount = cloudCount / 2u;
    let side = select(
      1u,
      0u,
      cloudIndex < perCloudCount,
    );
    let localCloudIndex =
      cloudIndex - side * perCloudCount;
    let moistureIndex =
      u32(params.grid.x) * u32(params.grid.y) + side;
    let activeCount = min(
      atomicLoad(&gridHeads[moistureIndex]),
      perCloudCount,
    );
    var cloudCorrection = corrections[index];
    let cloudTarget =
      cloudCorrection.vectors.xy +
      driftingCloudOffset(
        cloudCorrection.glyphLifecycle.y,
        cloudCorrection.glyphLifecycle.z,
      );
    let cloudSource = cloudCorrection.vectors.zw;
    let leftCloud = side == 0u;
    var releaseAge =
      cloudCorrection.glyphLifecycle.w;
    if (releaseAge > 0.0) {
      releaseAge += dt;
      var rainBlend = clamp(
        cloudCorrection.glyphLifecycle.x,
        0.0,
        1.0,
      );
      let targetRainBlend = select(
        0.0,
        1.0,
        position.x >= params.viewport.x * 0.5,
      );
      let morphStep = dt / WEATHER_MORPH_SECONDS;
      rainBlend += clamp(
        targetRainBlend - rainBlend,
        -morphStep,
        morphStep,
      );
      let snowBlend = 1.0 - rainBlend;
      let releaseGravity = mix(
        38.0,
        params.simulation.w,
        rainBlend,
      );
      velocity.y += releaseGravity * dt;
      let swayVelocity =
        sin(params.motion.x * 1.7 + f32(index) * 0.73) *
          34.0 +
        sin(params.motion.x * 0.67 + f32(index) * 1.11) *
          12.0;
      velocity.x +=
        (swayVelocity - velocity.x) *
        min(1.0, dt * 1.8) *
        snowBlend;
      let targetFallSpeed = mix(62.0, 135.0, rainBlend);
      velocity.y +=
        (targetFallSpeed - velocity.y) *
        min(1.0, dt * 5.2);
      velocity.y = min(
        velocity.y,
        mix(76.0, 250.0, rainBlend),
      );
      velocity = applyBoatInteraction(
        position,
        velocity,
      );
      position += velocity * dt;
      if (
        releaseAge >= CLOUD_RELEASE_SECONDS ||
        position.y >= params.viewport.y * 0.795
      ) {
        cloudCorrection.glyphLifecycle.x = select(
          1.0,
          0.0,
          leftCloud,
        );
        cloudCorrection.glyphLifecycle.w = 0.0;
        corrections[index] = cloudCorrection;
        lambdas[index] = 0.0;
        positions[index] = cloudSource;
        previousPositions[index] = cloudSource;
        velocities[index] = vec2<f32>(0.0);
        return;
      }
      cloudCorrection.glyphLifecycle.x = rainBlend;
      cloudCorrection.glyphLifecycle.w = releaseAge;
      corrections[index] = cloudCorrection;
      positions[index] = projectBoundary(position);
      velocities[index] = velocity;
      return;
    }
    if (localCloudIndex < activeCount) {
      if (lambdas[index] < 0.5) {
        position = cloudSource;
        previousPositions[index] = position;
        velocity = vec2<f32>(0.0, -18.0);
        lambdas[index] = 1.0;
      }
      if (
        params.interaction.z > 0.5 &&
        length(params.pointer.zw) > 16.0
      ) {
        let fromPointer =
          position - params.pointer.xy;
        let distance = length(fromPointer);
        let releaseRadius = max(
          20.0,
          params.interaction.x * 0.52,
        );
        if (distance < releaseRadius) {
          var direction = vec2<f32>(0.0, 1.0);
          if (distance > 0.001) {
            direction = fromPointer / distance;
          }
          let falloff =
            1.0 - distance / releaseRadius;
          let releaseSeed = fract(
            sin((f32(index) + 2.73) * 12.9898) *
            43758.5453,
          );
          let secondarySeed = fract(
            sin((f32(index) + 8.19) * 7.113) *
            23421.631,
          );
          cloudCorrection.glyphLifecycle.x = select(
            1.0,
            0.0,
            leftCloud,
          );
          cloudCorrection.glyphLifecycle.w = 0.001;
          corrections[index] = cloudCorrection;
          lambdas[index] = 2.0;
          position += vec2<f32>(
            (releaseSeed - 0.5) * 9.0,
            (secondarySeed - 0.5) * 5.0,
          );
          velocity = vec2<f32>(
            clamp(
              params.pointer.z * 0.07,
              -190.0,
              190.0,
            ) +
              direction.x * 42.0 * falloff +
              (releaseSeed - 0.5) * 110.0,
            select(
              125.0 + secondarySeed * 48.0,
              48.0 + secondarySeed * 26.0,
              leftCloud,
            ),
          );
          position += velocity * dt;
          positions[index] = projectBoundary(position);
          velocities[index] = velocity;
          return;
        }
      }
      velocity +=
        (cloudTarget - position) * 10.0 * dt;
      velocity *= exp(-4.2 * dt);
      velocity = applyBoatInteraction(
        position,
        velocity,
      );
      position += velocity * dt;
      positions[index] = position;
      velocities[index] = velocity;
    } else {
      let hiddenPosition = vec2<f32>(-100.0);
      positions[index] = hiddenPosition;
      previousPositions[index] = hiddenPosition;
      velocities[index] = vec2<f32>(0.0);
      lambdas[index] = 0.0;
    }
    return;
  }

  if (isVaporParticle(index)) {
    var vaporCorrection = corrections[index];
    var vaporAge =
      vaporCorrection.glyphLifecycle.w + dt;
    var interactionOffset =
      vaporCorrection.vectors.xy;
    var interactionVelocity =
      vaporCorrection.vectors.zw;
    let vaporIndex = f32(index) - params.vapor.x;
    let goesLeft =
      vaporIndex < params.vapor.y * 0.5;
    if (vaporAge >= params.vapor.z) {
      vaporAge -= params.vapor.z;
      interactionOffset = vec2<f32>(0.0);
      interactionVelocity = vec2<f32>(0.0);
      addCloudMoisture(
        select(1u, 0u, goesLeft),
      );
    }
    let seed = fract(
      sin((vaporIndex * 2.17 + 6.8) * 12.9898) *
      43758.5453,
    );
    let secondarySeed = fract(
      sin((vaporIndex * 4.31 + 1.9) * 12.9898) *
      43758.5453,
    );
    let progress = vaporAge / params.vapor.z;
    let easedProgress =
      progress * progress * (3.0 - 2.0 * progress);
    let sourceX = select(
      params.viewport.x * (0.52 + secondarySeed * 0.4),
      params.viewport.x * (0.08 + secondarySeed * 0.4),
      goesLeft,
    );
    let cloudAnchor =
      vaporCorrection.glyphLifecycle.xy +
      driftingCloudOffset(
        vaporCorrection.glyphLifecycle.z,
        max(4.5, params.cloudLayout.w * 0.045),
      );
    let arch =
      sin(progress * PI) *
      (10.0 + secondarySeed * 13.0);
    let drift =
      sin(progress * PI * 4.0 + vaporIndex * 1.37) *
      (7.0 + secondarySeed * 7.0) *
      sin(progress * PI);
    let trackPosition = vec2<f32>(
      mix(sourceX, cloudAnchor.x, easedProgress) + drift,
      mix(params.vapor.w, cloudAnchor.y, easedProgress) -
        arch,
    );
    interactionVelocity +=
      -interactionOffset * 5.2 * dt;
    interactionVelocity *= exp(-2.6 * dt);
    let interactionPosition =
      trackPosition + interactionOffset;
    if (params.interaction.z > 0.5) {
      let interactionRadius =
        params.interaction.x * 1.15;
      let fromPointer =
        interactionPosition - params.pointer.xy;
      let distance = length(fromPointer);
      if (distance < interactionRadius) {
        let falloff =
          1.0 - distance / interactionRadius;
        let weightedFalloff = falloff * falloff;
        var direction = vec2<f32>(0.0, -1.0);
        if (distance > 0.001) {
          direction = fromPointer / distance;
        }
        interactionVelocity.x +=
          params.pointer.z *
          (0.42 * weightedFalloff);
        interactionVelocity.y +=
          params.pointer.w *
          (0.3 * weightedFalloff);
        interactionVelocity +=
          direction *
          params.interaction.y *
          weightedFalloff;
      }
    }
    interactionVelocity = applyBoatInteraction(
      interactionPosition,
      interactionVelocity,
    );
    let interactionSpeed =
      length(interactionVelocity);
    if (interactionSpeed > 360.0) {
      interactionVelocity *=
        360.0 / interactionSpeed;
    }
    interactionOffset +=
      interactionVelocity * dt;
    let offsetLength = length(interactionOffset);
    let maximumOffset =
      params.interaction.x * 1.7;
    if (offsetLength > maximumOffset) {
      interactionOffset *=
        maximumOffset / offsetLength;
      interactionVelocity *= 0.55;
    }
    position = trackPosition + interactionOffset;
    velocity =
      (position - previousPositions[index]) / dt;
    vaporCorrection.vectors = vec4<f32>(
      interactionOffset,
      interactionVelocity,
    );
    vaporCorrection.glyphLifecycle.w = vaporAge;
    corrections[index] = vaporCorrection;
    lambdas[index] = 0.0;
    positions[index] = projectBoundary(position);
    velocities[index] = velocity;
    return;
  }

  if (isRainParticle(index)) {
    var rainCorrection = corrections[index];
    var rainAge =
      rainCorrection.glyphLifecycle.y + dt;
    var snowBlend = clamp(
      rainCorrection.glyphLifecycle.w,
      0.0,
      1.0,
    );
    if (rainAge >= RAIN_CYCLE_SECONDS) {
      rainAge -= RAIN_CYCLE_SECONDS;
      let rainIndex =
        f32(index) - params.weather.x;
      if (u32(rainIndex) % 6u == 0u) {
        consumeCloudMoisture(1u);
      }
      let cloudAnchor =
        rainCorrection.vectors.zw +
        driftingCloudOffset(
          f32(index) * 0.731,
          max(4.5, params.cloudLayout.w * 0.045),
        );
      let spread = params.cloudLayout.w * 0.68;
      let seed = fract(
        sin((rainIndex + 1.37) * 12.9898) *
        43758.5453,
      );
      position = vec2<f32>(
        cloudAnchor.x +
          (seed - 0.5) * spread,
        cloudAnchor.y,
      );
      velocity = vec2<f32>(
        sin(rainIndex * 1.91) * 8.0,
        28.0 + seed * 22.0,
      );
      previousPositions[index] = position;
      lambdas[index] = 0.0;
      snowBlend = 0.0;
      rainCorrection.glyphLifecycle.w = 0.0;
    }
    if (position.y < params.viewport.y * 0.795) {
      let targetSnowBlend = select(
        0.0,
        1.0,
        position.x < params.viewport.x * 0.5,
      );
      let morphStep = dt / WEATHER_MORPH_SECONDS;
      snowBlend += clamp(
        targetSnowBlend - snowBlend,
        -morphStep,
        morphStep,
      );
      rainCorrection.glyphLifecycle.w = snowBlend;
      let depthSeed = fract(
        sin((f32(index) + 13.71) * 9.731) *
        31415.9265
      );
      let targetFallSpeed =
        mix(
          118.0 + depthSeed * 72.0,
          30.0 + depthSeed * 38.0,
          snowBlend,
        );
      velocity.y +=
        (targetFallSpeed - velocity.y) *
        min(1.0, dt * 5.2);
    }
    rainCorrection.glyphLifecycle.y = rainAge;
    corrections[index] = rainCorrection;
  }

  let snowParticle = isSnowParticle(index);
  if (snowParticle) {
    var snowCorrection = corrections[index];
    var snowAge =
      snowCorrection.glyphLifecycle.z + dt;
    var rainBlend = clamp(
      snowCorrection.glyphLifecycle.w,
      0.0,
      1.0,
    );
    if (snowAge >= SNOW_CYCLE_SECONDS) {
      snowAge -= SNOW_CYCLE_SECONDS;
      let snowIndex =
        f32(index) - params.climate.x;
      if (u32(snowIndex) % 3u == 0u) {
        consumeCloudMoisture(0u);
      }
      let cloudAnchor =
        snowCorrection.vectors.zw +
        driftingCloudOffset(
          f32(index) * 0.677,
          max(4.5, params.cloudLayout.w * 0.045),
        );
      let spread = params.cloudLayout.w * 0.68;
      let seed = fract(
        sin((snowIndex + 2.71) * 12.9898) *
        43758.5453,
      );
      position = vec2<f32>(
        cloudAnchor.x +
          (seed - 0.5) * spread,
        cloudAnchor.y,
      );
      velocity = vec2<f32>(
        sin(snowIndex * 1.41) * 18.0,
        30.0 + seed * 12.0,
      );
      previousPositions[index] = position;
      lambdas[index] = 0.0;
      rainBlend = 0.0;
      snowCorrection.glyphLifecycle.w = 0.0;
    }
    if (position.y < params.viewport.y * 0.795) {
      let targetRainBlend = select(
        0.0,
        1.0,
        position.x >= params.viewport.x * 0.5,
      );
      let morphStep = dt / WEATHER_MORPH_SECONDS;
      rainBlend += clamp(
        targetRainBlend - rainBlend,
        -morphStep,
        morphStep,
      );
      snowCorrection.glyphLifecycle.w = rainBlend;
      let depthSeed = fract(
        sin((f32(index) + 13.71) * 9.731) *
        31415.9265
      );
      let targetFallSpeed =
        mix(
          30.0 + depthSeed * 38.0,
          118.0 + depthSeed * 72.0,
          rainBlend,
        );
      velocity.y +=
        (targetFallSpeed - velocity.y) *
        min(1.0, dt * 5.2);
    }
    snowCorrection.glyphLifecycle.z = snowAge;
    corrections[index] = snowCorrection;
  }

  var particleState = lambdas[index];
  let originalGlyphParticle = isOriginalGlyphParticle(index);
  var storedCorrection = corrections[index];
  var releaseMarker = storedCorrection.glyphLifecycle.x;

  if (
    originalGlyphParticle &&
    !isGlyphParticle(particleState) &&
    releaseMarker > 0.0 &&
    params.motion.x - releaseMarker >= params.lifecycle.y
  ) {
    let coreLimit =
      params.lifecycle.x + params.lifecycle.w;
    particleState = select(
      ATTACHED_STATE,
      -2e20,
      f32(index) < coreLimit,
    );
    lambdas[index] = particleState;
    releaseMarker = -params.motion.x;
    storedCorrection.glyphLifecycle.x = releaseMarker;
    corrections[index] = storedCorrection;
  }

  if (isGlyphParticle(particleState)) {
    let coreParticle = isCoreParticle(particleState);
    var released = false;
    if (
      params.interaction.z > 0.5 &&
      length(params.pointer.zw) > 16.0
    ) {
      let radius = max(
        20.0,
        smoothingRadius() * 1.35,
      );
      let fromPointer = position - params.pointer.xy;
      let distance = length(fromPointer);
      if (distance < radius) {
        let falloff = 1.0 - distance / radius;
        var direction = vec2<f32>(0.0, 1.0);
        if (distance > 0.001) {
          direction = fromPointer / distance;
        }
        lambdas[index] = 0.0;
        velocity += params.pointer.zw * (0.2 * falloff);
        velocity += direction * (55.0 * falloff);
        velocity.y = max(velocity.y + 95.0, 105.0);
        if (originalGlyphParticle) {
          storedCorrection =
            corrections[index];
          storedCorrection.glyphLifecycle.x =
            params.motion.x;
          corrections[index] = storedCorrection;
        }
        released = true;
      }
    }

    if (!released) {
      velocity += glyphWeatherImpact(position);
      storedCorrection = corrections[index];
      let baseTarget = select(
        storedCorrection.vectors.xy,
        storedCorrection.vectors.zw,
        originalGlyphParticle,
      );
      let animatedTarget =
        animatedGlyphTarget(baseTarget);
      var attraction = select(
        12.0,
        10.0,
        coreParticle,
      );
      var damping = 4.6;
      if (
        originalGlyphParticle &&
        releaseMarker < 0.0
      ) {
        let reformElapsed =
          params.motion.x + releaseMarker;
        let reformProgress = smoothstep(
          0.0,
          params.lifecycle.z,
          reformElapsed,
        );
        attraction = mix(
          4.2,
          16.0,
          reformProgress,
        );
        damping = mix(
          1.8,
          5.2,
          reformProgress,
        );
        if (reformElapsed >= params.lifecycle.z) {
          storedCorrection.glyphLifecycle.x = 0.0;
          corrections[index] = storedCorrection;
        }
      }
      velocity +=
        (animatedTarget - position) *
        attraction *
        dt;
      velocity *= exp(-damping * dt);
      velocity = applyBoatInteraction(
        position,
        velocity,
      );
      position += velocity * dt;
      positions[index] = projectBoundary(position);
      velocities[index] = velocity;
      return;
    }
  }

  let fallingSnowForAttachment =
    isSnowLikeParticle(index) &&
    velocity.y > 8.0;
  let risingWaterForAttachment =
    !isSnowLikeParticle(index) &&
    !isRainLikeParticle(index) &&
    !isVaporParticle(index) &&
    !isCloudParticle(index) &&
    velocity.y < -18.0;
  if (
    !(originalGlyphParticle && releaseMarker > 0.0) &&
    (
      fallingSnowForAttachment ||
      risingWaterForAttachment
    ) &&
    position.y > params.viewport.y * 0.4 &&
    position.y < params.viewport.y * 0.72
  ) {
    let attachment = queryGlyphAttachment(position);
    if (
      attachment.distance <
      max(8.0, smoothingRadius() * 0.9)
    ) {
      let snowAttachmentSeed = fract(
        sin((f32(index) + 4.17) * 12.9898) *
        43758.5453,
      );
      let shouldAttach =
        risingWaterForAttachment ||
        (
          fallingSnowForAttachment &&
          snowAttachmentSeed < 0.18
        );
      var attachmentTarget = attachment.baseTarget;
      if (attachment.distance > 0.001) {
        attachmentTarget +=
          normalize(position - attachment.animatedTarget) *
          params.interaction.w *
          0.8;
      }
      if (shouldAttach) {
        lambdas[index] = ATTACHED_STATE;
        storedCorrection = corrections[index];
        storedCorrection.vectors = vec4<f32>(
          attachmentTarget,
          storedCorrection.vectors.zw,
        );
        corrections[index] = storedCorrection;
        velocities[index] = select(
          velocity * 0.16,
          vec2<f32>(velocity.x * 0.08, 0.0),
          fallingSnowForAttachment,
        );
        positions[index] = position;
        return;
      }
      if (fallingSnowForAttachment) {
        let normal = normalize(
          position - attachment.animatedTarget +
          vec2<f32>(0.001, 0.0),
        );
        velocity.x += normal.x * 22.0;
        velocity.y *= 0.64;
        position += normal * 1.15;
      }
    }
  }

  let rainLikeParticle = isRainLikeParticle(index);
  let airborneRain =
    rainLikeParticle &&
    position.y < params.viewport.y * 0.795;
  if (airborneRain) {
    velocity.x *= exp(-3.2 * dt);
  }
  if (
    rainLikeParticle &&
    position.y > params.viewport.y * 0.38 &&
    position.y < params.viewport.y * 0.74
  ) {
    let glyphTransit =
      queryGlyphAttachment(position);
    if (
      glyphTransit.distance <
      max(9.0, smoothingRadius() * 0.86)
    ) {
      var transitNormal = normalize(
        position - glyphTransit.animatedTarget +
        vec2<f32>(0.001, 0.0),
      );
      let transitSeed = fract(
        sin((f32(index) + 5.41) * 12.9898) *
        43758.5453,
      );
      velocity.x =
        velocity.x * 0.62 +
        transitNormal.x * (28.0 + transitSeed * 20.0);
      velocity.y = max(velocity.y, 220.0);
      position.x += transitNormal.x * 1.6;
      position.y +=
        min(7.0, velocity.y * dt * 0.5);
    }
  }

  let airborneSnow =
    isSnowLikeParticle(index) &&
    position.y < params.viewport.y * 0.795;
  let particleGravity = select(
    params.simulation.w,
    38.0,
    airborneSnow,
  );
  velocity.y += particleGravity * dt;
  if (airborneSnow) {
    let snowDepth = fract(
      sin((f32(index) + 13.71) * 9.731) *
      31415.9265
    );
    let swayVelocity =
      sin(params.motion.x * 1.7 + f32(index) * 0.73) *
        mix(13.0, 34.0, snowDepth) +
      sin(params.motion.x * 0.67 + f32(index) * 1.11) *
        mix(4.0, 12.0, snowDepth);
    velocity.x +=
      (swayVelocity - velocity.x) *
      min(1.0, dt * 1.8);
    velocity.y = min(
      velocity.y,
      42.0 + snowDepth * 34.0,
    );
  }

  if (params.interaction.z > 0.5) {
    let radius = params.interaction.x;
    let fromPointer = position - params.pointer.xy;
    let distance = length(fromPointer);
    if (distance < radius) {
      let falloff = (1.0 - distance / radius);
      let weightedFalloff = falloff * falloff;
      var direction = vec2<f32>(0.0, -1.0);
      if (distance > 0.001) {
        direction = fromPointer / distance;
      }
      velocity.x +=
        params.pointer.z *
        (0.38 * weightedFalloff);
      velocity.y +=
        params.pointer.w *
        (0.24 * weightedFalloff);
      velocity += direction * params.interaction.y * weightedFalloff;
    }
  }

  velocity = applyBoatInteraction(position, velocity);
  position += velocity * dt;
  if (
    airborneSnow &&
    position.y >= params.viewport.y * 0.795
  ) {
    velocity.x +=
      sin(params.motion.x * 2.4 + f32(index) * 0.91) *
      52.0;
    velocity.y += 105.0;
    position.y = params.viewport.y * 0.795 + 1.0;
  }
  positions[index] = projectBoundary(position);
  velocities[index] = velocity;
}

@compute @workgroup_size(128)
fn buildHash(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let index = invocation.x;
  if (index >= particleCount()) {
    return;
  }
  if (
    isGlyphParticle(lambdas[index]) ||
    isVaporParticle(index) ||
    isCloudParticle(index) ||
    isFreeFallingPrecipitation(index)
  ) {
    gridNext[index] = 0u;
    return;
  }
  let cell = cellCoordinates(positions[index]);
  let previousHead = atomicExchange(&gridHeads[cellIndex(cell)], index + 1u);
  gridNext[index] = previousHead;
}

@compute @workgroup_size(128)
fn solveLambda(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let index = invocation.x;
  if (index >= particleCount()) {
    return;
  }
  if (isFreeFallingPrecipitation(index)) {
    lambdas[index] = 0.0;
    return;
  }
  if (
    isGlyphParticle(lambdas[index]) ||
    isVaporParticle(index) ||
    isCloudParticle(index)
  ) {
    return;
  }

  let position = positions[index];
  let baseCell = cellCoordinates(position);
  let restDensity = params.simulation.x;
  var density = 0.0;
  var gradientI = vec2<f32>(0.0);
  var sumGradientSquared = 0.0;

  for (var offsetY = -1; offsetY <= 1; offsetY = offsetY + 1) {
    let cellY = baseCell.y + offsetY;
    if (cellY < 0 || cellY >= i32(params.grid.y)) {
      continue;
    }
    for (var offsetX = -1; offsetX <= 1; offsetX = offsetX + 1) {
      let cellX = baseCell.x + offsetX;
      if (cellX < 0 || cellX >= i32(params.grid.x)) {
        continue;
      }

      var node = atomicLoad(
        &gridHeads[cellIndex(vec2<i32>(cellX, cellY))]
      );
      while (node != 0u) {
        let other = node - 1u;
        if (other != index) {
          let radius = position - positions[other];
          let radiusSquared = dot(radius, radius);
          if (radiusSquared > 0.0 && radiusSquared < smoothingRadius() * smoothingRadius()) {
            density += poly6Kernel(radiusSquared);
            let gradientJ = -spikyGradient(radius) / restDensity;
            sumGradientSquared += dot(gradientJ, gradientJ);
            gradientI += gradientJ;
          }
        }
        node = gridNext[other];
      }
    }
  }

  sumGradientSquared += dot(gradientI, gradientI);
  let constraint = density / restDensity - 1.0;
  lambdas[index] = -constraint / (sumGradientSquared + params.simulation.y);
}

@compute @workgroup_size(128)
fn solveCorrection(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let index = invocation.x;
  if (index >= particleCount()) {
    return;
  }
  if (
    isGlyphParticle(lambdas[index]) ||
    isVaporParticle(index) ||
    isCloudParticle(index) ||
    isFreeFallingPrecipitation(index)
  ) {
    return;
  }

  let position = positions[index];
  let baseCell = cellCoordinates(position);
  let restDensity = params.simulation.x;
  let h = smoothingRadius();
  let referenceKernel = max(poly6Kernel(0.09 * h * h), 0.0000001);
  var correction = vec2<f32>(0.0);

  for (var offsetY = -1; offsetY <= 1; offsetY = offsetY + 1) {
    let cellY = baseCell.y + offsetY;
    if (cellY < 0 || cellY >= i32(params.grid.y)) {
      continue;
    }
    for (var offsetX = -1; offsetX <= 1; offsetX = offsetX + 1) {
      let cellX = baseCell.x + offsetX;
      if (cellX < 0 || cellX >= i32(params.grid.x)) {
        continue;
      }

      var node = atomicLoad(
        &gridHeads[cellIndex(vec2<i32>(cellX, cellY))]
      );
      while (node != 0u) {
        let other = node - 1u;
        if (other != index) {
          let radius = position - positions[other];
          let radiusSquared = dot(radius, radius);
          if (radiusSquared > 0.0 && radiusSquared < h * h) {
            let kernelRatio = poly6Kernel(radiusSquared) / referenceKernel;
            let ratioSquared = kernelRatio * kernelRatio;
            let artificialPressure = -0.0018 * ratioSquared * ratioSquared;
            correction += (
              lambdas[index] + lambdas[other] + artificialPressure
            ) * spikyGradient(radius);
          }
        }
        node = gridNext[other];
      }
    }
  }

  correction /= restDensity;
  let correctionLength = length(correction);
  let maximumCorrection = params.interaction.w * 0.36;
  if (correctionLength > maximumCorrection) {
    correction *= maximumCorrection / correctionLength;
  }
  var storedCorrection = corrections[index];
  storedCorrection.vectors = vec4<f32>(
    correction,
    storedCorrection.vectors.zw,
  );
  corrections[index] = storedCorrection;
}

@compute @workgroup_size(128)
fn applyCorrection(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let index = invocation.x;
  if (index >= particleCount()) {
    return;
  }
  if (
    isGlyphParticle(lambdas[index]) ||
    isVaporParticle(index) ||
    isCloudParticle(index) ||
    isFreeFallingPrecipitation(index)
  ) {
    return;
  }
  positions[index] = projectBoundary(
    positions[index] +
    corrections[index].vectors.xy,
  );
}

@compute @workgroup_size(128)
fn reconstructVelocity(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let index = invocation.x;
  if (index >= particleCount()) {
    return;
  }
  if (
    isGlyphParticle(lambdas[index]) ||
    isVaporParticle(index) ||
    isCloudParticle(index) ||
    isFreeFallingPrecipitation(index)
  ) {
    velocities[index] =
      (positions[index] - previousPositions[index]) /
      params.viewport.w;
    return;
  }

  let padding = params.interaction.w;
  let position = positions[index];
  var velocity = (position - previousPositions[index]) / params.viewport.w;
  let maximum = params.viewport.xy - vec2<f32>(padding);
  let boundaryBand = max(0.75, padding * 0.22);

  if (
    position.x <= padding + boundaryBand &&
    velocity.x < 0.0
  ) {
    velocity.x = 0.0;
    velocity.y *= 0.84;
  }
  if (
    position.x >= maximum.x - boundaryBand &&
    velocity.x > 0.0
  ) {
    velocity.x = 0.0;
    velocity.y *= 0.84;
  }
  if (
    position.y <= padding + boundaryBand &&
    velocity.y < 0.0
  ) {
    velocity.y = 0.0;
    velocity.x *= 0.84;
  }
  if (
    position.y >= maximum.y - boundaryBand &&
    velocity.y > 0.0
  ) {
    velocity.y = 0.0;
    velocity.x *= 0.9;
  }

  let speed = length(velocity);
  let maximumSpeed = params.grid.w;
  if (speed > maximumSpeed) {
    velocity *= maximumSpeed / speed;
  }
  velocities[index] = velocity * 0.994;
}

@compute @workgroup_size(128)
fn solveViscosity(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let index = invocation.x;
  if (index >= particleCount()) {
    return;
  }
  if (
    isGlyphParticle(lambdas[index]) ||
    isVaporParticle(index) ||
    isCloudParticle(index) ||
    isFreeFallingPrecipitation(index)
  ) {
    smoothedVelocities[index] = velocities[index];
    return;
  }

  let position = positions[index];
  let velocity = velocities[index];
  let baseCell = cellCoordinates(position);
  let restDensity = params.simulation.x;
  var correction = vec2<f32>(0.0);

  for (var offsetY = -1; offsetY <= 1; offsetY = offsetY + 1) {
    let cellY = baseCell.y + offsetY;
    if (cellY < 0 || cellY >= i32(params.grid.y)) {
      continue;
    }
    for (var offsetX = -1; offsetX <= 1; offsetX = offsetX + 1) {
      let cellX = baseCell.x + offsetX;
      if (cellX < 0 || cellX >= i32(params.grid.x)) {
        continue;
      }

      var node = atomicLoad(
        &gridHeads[cellIndex(vec2<i32>(cellX, cellY))]
      );
      while (node != 0u) {
        let other = node - 1u;
        if (other != index) {
          let radius = position - positions[other];
          let radiusSquared = dot(radius, radius);
          if (radiusSquared > 0.0 && radiusSquared < smoothingRadius() * smoothingRadius()) {
            let weight = poly6Kernel(radiusSquared) / restDensity;
            correction += (velocities[other] - velocity) * weight;
          }
        }
        node = gridNext[other];
      }
    }
  }

  smoothedVelocities[index] = velocity + params.grid.z * correction;
}

@compute @workgroup_size(128)
fn applyViscosity(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let index = invocation.x;
  if (index >= particleCount()) {
    return;
  }
  if (
    isGlyphParticle(lambdas[index]) ||
    isVaporParticle(index) ||
    isCloudParticle(index) ||
    isFreeFallingPrecipitation(index)
  ) {
    return;
  }
  velocities[index] = smoothedVelocities[index];
}
