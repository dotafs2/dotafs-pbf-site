struct CloudRenderParams {
  display: vec4<f32>,
  simulation: vec4<f32>,
  style: vec4<f32>,
}

@group(0) @binding(0)
var<storage, read> positions: array<vec2<f32>>;

@group(0) @binding(1)
var<storage, read> states: array<vec4<f32>>;

@group(0) @binding(2)
var<uniform> params: CloudRenderParams;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) local_position: vec2<f32>,
  @location(1) phase: f32,
  @location(2) visibility: f32,
  @location(3) rain: f32,
  @location(4) water: f32,
  @location(5) snow: f32,
}

fn day_mix(fragment_position: vec4<f32>) -> f32 {
  return smoothstep(
    params.display.x * 0.46,
    params.display.x * 0.54,
    fragment_position.x,
  );
}

@vertex
fn cloud_density_vertex(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32,
) -> VertexOutput {
  let corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
  );
  let state = states[instance_index];
  let water = select(0.0, 1.0, state.x < -0.5);
  let precipitation =
    select(0.0, 1.0, state.x > 1.5);
  let snow = select(0.0, 1.0, state.x > 2.5);
  let rain = precipitation * (1.0 - snow);
  let phase = clamp(state.x, 0.0, 1.0);
  let visibility =
    state.w * select(0.0, 1.0, state.y >= 0.0);
  let airborne_radius = mix(
    params.style.w,
    params.simulation.w,
    smoothstep(0.08, 0.78, phase),
  );
  let radius = mix(
    airborne_radius,
    params.simulation.z,
    water,
  );
  let local_position = corners[vertex_index];
  var particle_scale = mix(
    vec2<f32>(radius),
    vec2<f32>(
      params.style.w * 0.13,
      params.style.w * 0.76,
    ),
    rain,
  );
  particle_scale = mix(
    particle_scale,
    vec2<f32>(params.style.w * 0.3),
    snow,
  );
  let pixel_position =
    positions[instance_index] +
    local_position * particle_scale;
  let clip_position = vec2<f32>(
    pixel_position.x / params.simulation.x * 2.0 - 1.0,
    1.0 - pixel_position.y / params.simulation.y * 2.0,
  );

  var output: VertexOutput;
  output.position = vec4<f32>(clip_position, 0.0, 1.0);
  output.local_position = local_position;
  output.phase = phase;
  output.visibility = visibility;
  output.rain = rain;
  output.water = water;
  output.snow = snow;
  return output;
}

@fragment
fn cloud_density_fragment(
  input: VertexOutput,
) -> @location(0) vec4<f32> {
  let radius_squared =
    dot(input.local_position, input.local_position);
  if (radius_squared >= 1.0 || input.visibility < 0.5) {
    discard;
  }
  let falloff = 1.0 - radius_squared;
  let kernel = falloff * falloff * falloff;
  if (input.water > 0.5) {
    let water_density = kernel * 0.72;
    return vec4<f32>(water_density, 0.0, 0.0, 0.0);
  }
  if (input.rain > 0.5 || input.snow > 0.5) {
    discard;
  }
  let weight =
    kernel *
    mix(0.26, 0.86, smoothstep(0.05, 0.86, input.phase));
  let condensed = weight * input.phase;
  let vapor = weight * (1.0 - input.phase);
  return vec4<f32>(weight, condensed, vapor, 0.0);
}

@fragment
fn unified_particle_fragment(
  input: VertexOutput,
) -> @location(0) vec4<f32> {
  let radius_squared =
    dot(input.local_position, input.local_position);
  if (radius_squared >= 1.0 || input.visibility < 0.5) {
    discard;
  }
  let falloff = 1.0 - radius_squared;
  let alpha = smoothstep(0.0, 0.72, falloff);
  let warmth = day_mix(input.position);

  if (input.water > 0.5) {
    let water_color = mix(
      mix(
        vec3<f32>(0.04, 0.16, 0.48),
        vec3<f32>(0.34, 0.1, 0.28),
        warmth,
      ),
      mix(
        vec3<f32>(0.32, 0.74, 1.0),
        vec3<f32>(1.0, 0.48, 0.35),
        warmth,
      ),
      falloff,
    );
    return vec4<f32>(water_color, alpha * 0.86);
  }
  if (input.rain > 0.5) {
    let rain_color = mix(
      mix(
        vec3<f32>(0.2, 0.56, 0.9),
        vec3<f32>(0.9, 0.4, 0.28),
        warmth,
      ),
      mix(
        vec3<f32>(0.76, 0.96, 1.0),
        vec3<f32>(1.0, 0.84, 0.52),
        warmth,
      ),
      falloff,
    );
    return vec4<f32>(rain_color, alpha * 0.92);
  }
  if (input.snow > 0.5) {
    let snow_color = mix(
      vec3<f32>(0.58, 0.78, 0.9),
      vec3<f32>(0.94, 0.99, 1.0),
      falloff,
    );
    return vec4<f32>(snow_color, alpha * 0.92);
  }

  let vapor_color = mix(
    vec3<f32>(0.24, 0.54, 0.84),
    vec3<f32>(0.8, 0.37, 0.35),
    warmth,
  );
  let cloud_color = mix(
    vec3<f32>(0.82, 0.94, 1.0),
    vec3<f32>(1.0, 0.82, 0.58),
    warmth,
  );
  let particle_color = mix(
    vapor_color,
    cloud_color,
    smoothstep(0.1, 0.82, input.phase),
  );
  return vec4<f32>(
    particle_color * (0.74 + falloff * 0.26),
    alpha * mix(0.42, 0.88, input.phase),
  );
}

@fragment
fn precipitation_particle_fragment(
  input: VertexOutput,
) -> @location(0) vec4<f32> {
  let radius_squared =
    dot(input.local_position, input.local_position);
  if (
    radius_squared >= 1.0 ||
    input.visibility < 0.5 ||
    (input.rain < 0.5 && input.snow < 0.5)
  ) {
    discard;
  }

  let falloff = 1.0 - radius_squared;
  let alpha = smoothstep(0.0, 0.72, falloff);
  let warmth = day_mix(input.position);
  if (input.snow > 0.5) {
    let axis0 = abs(input.local_position.y);
    let axis1 = abs(
      dot(
        input.local_position,
        normalize(vec2<f32>(0.5, 0.8660254)),
      )
    );
    let axis2 = abs(
      dot(
        input.local_position,
        normalize(vec2<f32>(0.5, -0.8660254)),
      )
    );
    let arm_distance = min(axis0, min(axis1, axis2));
    let flake_mask =
      (1.0 - smoothstep(0.1, 0.2, arm_distance)) *
      (1.0 - smoothstep(0.72, 1.0, radius_squared));
    if (flake_mask < 0.02) {
      discard;
    }
    let snow_color = mix(
      vec3<f32>(0.55, 0.77, 0.9),
      vec3<f32>(0.96, 1.0, 1.0),
      falloff,
    );
    return vec4<f32>(
      snow_color,
      flake_mask * (0.7 + alpha * 0.3),
    );
  }

  let rain_color = mix(
    mix(
      vec3<f32>(0.2, 0.56, 0.9),
      vec3<f32>(0.9, 0.4, 0.28),
      warmth,
    ),
    mix(
      vec3<f32>(0.76, 0.96, 1.0),
      vec3<f32>(1.0, 0.84, 0.52),
      warmth,
    ),
    falloff,
  );
  return vec4<f32>(rain_color, alpha * 0.92);
}
