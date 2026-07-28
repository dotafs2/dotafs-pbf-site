struct CloudRenderParams {
  display: vec4<f32>,
  simulation: vec4<f32>,
  style: vec4<f32>,
}

@group(0) @binding(0)
var<uniform> params: CloudRenderParams;

@group(0) @binding(1)
var density_texture: texture_2d<f32>;

@group(0) @binding(2)
var density_sampler: sampler;

@vertex
fn cloud_fullscreen_vertex(
  @builtin(vertex_index) vertex_index: u32,
) -> @builtin(position) vec4<f32> {
  let positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );
  return vec4<f32>(positions[vertex_index], 0.0, 1.0);
}

fn sample_density(uv: vec2<f32>) -> vec4<f32> {
  return textureSampleLevel(
    density_texture,
    density_sampler,
    clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0)),
    0.0,
  );
}

@fragment
fn cloud_surface_fragment(
  @builtin(position) fragment_position: vec4<f32>,
) -> @location(0) vec4<f32> {
  let uv = fragment_position.xy / params.display.xy;
  let field = sample_density(uv);
  let water = field.r;
  let condensed = field.g;
  let vapor = field.b;
  let rain = field.a;
  let threshold = params.style.x;
  let feather = params.style.y;
  let vapor_mask = smoothstep(0.018, 0.17, vapor);
  let cloud_mask = smoothstep(
    threshold - feather,
    threshold + feather,
    condensed,
  );
  let coverage = max(vapor_mask * 0.72, cloud_mask);
  let rain_mask = smoothstep(0.025, 0.24, rain);
  let combined_coverage = max(coverage, rain_mask);
  let day_mix = smoothstep(0.46, 0.54, uv.x);

  let texel = 1.0 / params.display.zw;
  let left_field = sample_density(
    uv - vec2<f32>(texel.x, 0.0),
  );
  let right_field = sample_density(
    uv + vec2<f32>(texel.x, 0.0),
  );
  let top_field = sample_density(
    uv - vec2<f32>(0.0, texel.y),
  );
  let bottom_field = sample_density(
    uv + vec2<f32>(0.0, texel.y),
  );
  let gradient = vec2<f32>(
    right_field.g - left_field.g,
    bottom_field.g - top_field.g,
  );
  let gradient_length = length(gradient);
  let light_direction = normalize(
    vec2<f32>(-0.62, -0.78),
  );
  let lighting = clamp(
    0.5 +
      dot(
        normalize(gradient + vec2<f32>(0.0001)),
        light_direction,
      ) *
      0.5,
    0.0,
    1.0,
  );

  let inner = smoothstep(
    threshold + feather * 0.5,
    threshold + 0.34,
    condensed,
  );
  let core = smoothstep(
    threshold + 0.42,
    threshold + 0.92,
    condensed,
  );
  let rim =
    cloud_mask *
    (1.0 - smoothstep(
      threshold + 0.03,
      threshold + 0.2,
      condensed,
    ));
  let lit_band =
    smoothstep(0.62, 0.78, lighting) *
    smoothstep(0.025, 0.16, gradient_length);

  let outline_color = mix(
    vec3<f32>(0.08, 0.12, 0.3),
    vec3<f32>(0.32, 0.1, 0.2),
    day_mix,
  );
  let shadow_color = mix(
    vec3<f32>(0.24, 0.4, 0.68),
    vec3<f32>(0.6, 0.27, 0.38),
    day_mix,
  );
  let middle_color = mix(
    vec3<f32>(0.52, 0.7, 0.9),
    vec3<f32>(0.9, 0.5, 0.42),
    day_mix,
  );
  let light_color = mix(
    vec3<f32>(0.86, 0.94, 1.0),
    vec3<f32>(1.0, 0.88, 0.63),
    day_mix,
  );
  var cloud_color = mix(shadow_color, middle_color, inner);
  cloud_color = mix(cloud_color, light_color, max(core, lit_band));
  cloud_color = mix(cloud_color, outline_color, rim * 0.92);

  let vapor_color =
    mix(
      vec3<f32>(0.2, 0.5, 0.78),
      vec3<f32>(0.82, 0.39, 0.36),
      day_mix,
    ) *
    (0.72 + lighting * 0.28);
  let phase_mix = smoothstep(
    0.04,
    0.32,
    condensed,
  );
  let body_color = mix(vapor_color, cloud_color, phase_mix);
  let rain_color = mix(
    mix(
      vec3<f32>(0.28, 0.66, 0.94),
      vec3<f32>(0.94, 0.52, 0.34),
      day_mix,
    ),
    mix(
      vec3<f32>(0.72, 0.94, 1.0),
      vec3<f32>(1.0, 0.88, 0.58),
      day_mix,
    ),
    smoothstep(0.04, 0.32, rain),
  );
  let final_alpha =
    1.0 - (1.0 - coverage) * (1.0 - rain_mask);
  let overlay_color =
    rain_color * rain_mask +
    body_color * coverage * (1.0 - rain_mask);

  let water_threshold = 0.43;
  let water_feather = 0.08;
  let water_mask = smoothstep(
    water_threshold - water_feather,
    water_threshold + water_feather,
    water,
  );
  let water_gradient = vec2<f32>(
    right_field.r - left_field.r,
    bottom_field.r - top_field.r,
  );
  let water_normal = normalize(
    vec3<f32>(-water_gradient * 7.0, 1.0),
  );
  let water_light_direction = normalize(
    vec3<f32>(-0.35, -0.55, 0.82),
  );
  let water_diffuse = max(
    dot(water_normal, water_light_direction),
    0.0,
  );
  let water_specular = pow(water_diffuse, 24.0);
  let depth_color = mix(
    vec3<f32>(0.035, 0.085, 0.3),
    vec3<f32>(0.22, 0.07, 0.2),
    day_mix,
  );
  let shallow_color = mix(
    vec3<f32>(0.18, 0.58, 0.88),
    vec3<f32>(0.86, 0.3, 0.3),
    day_mix,
  );
  let vertical_color = mix(
    shallow_color,
    depth_color,
    smoothstep(0.15, 1.0, uv.y),
  );
  let water_surface_band =
    1.0 -
    smoothstep(
      water_feather * 1.2,
      water_feather * 5.0,
      abs(water - water_threshold),
    );
  let water_edge_glow =
    smoothstep(0.015, 0.14, length(water_gradient)) *
    water_surface_band *
    water_mask;
  let water_color =
    vertical_color *
      (
        0.86 +
        water_diffuse * 0.16 * water_surface_band +
        water_specular * 0.72 * water_surface_band
      ) +
    mix(
      vec3<f32>(0.42, 0.78, 1.0),
      vec3<f32>(1.0, 0.58, 0.37),
      day_mix,
    ) * water_edge_glow;
  let total_alpha =
    1.0 -
    (1.0 - final_alpha) *
    (1.0 - water_mask);
  let final_color =
    overlay_color +
    water_color *
    water_mask *
    (1.0 - final_alpha);
  return vec4<f32>(final_color, total_alpha);
}
