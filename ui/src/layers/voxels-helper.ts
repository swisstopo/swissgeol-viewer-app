import {CustomShader, TextureUniform, UniformType} from 'cesium';

type ColorRamp = {
  image: Uint8Array,
  width: number,
  height: number,
}


function createCustomShader(config): CustomShader {
  const lithology = config.voxelFilter.lithology;

  const fragmentShaderText = `
    bool bitSet(int value, int index) {
      // return mod(floor((value + 0.5) / pow(2.0, float(index))), 2.0);
      return mod(floor((float(value) + 0.5) / pow(2.0, float(index))), 2.0) > 0.0;
    }
    void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
    {
      const int lithology_mapping_length = ${lithology.length};
      float lithology_mapping[lithology_mapping_length];
      ${lithology.map((lithology, index) => `lithology_mapping[${index}] = ${lithology.index.toFixed(1)};`).join(' ')}

      float value = fsInput.metadata.${config.voxelDataName};
      float lithology = fsInput.metadata.${config.voxelFilter.lithologyDataName};
      float conductivity = fsInput.metadata.${config.voxelFilter.conductivityDataName};

      if (lithology == u_noData && conductivity == u_noData) {
        return;
      }
      if (lithology == u_undefined_data && conductivity == u_undefined_data) {
        return;
      }

      bool conductivityInRange = conductivity >= u_filter_conductivity_min && conductivity <= u_filter_conductivity_max;

      // display undefined conductivity even if it is not in the range if the option is enabled
      if (u_filter_include_undefined_conductivity && conductivity == u_undefined_data) {
        conductivityInRange = true;
      }

      bool lithologySelected = true;

      for (int i = 0; i < lithology_mapping_length; i++) {
        if (lithology == lithology_mapping[i] && bitSet(u_filter_lithology_exclude, i)) {
          lithologySelected = false;
          break;
        }
      }

      bool display = false;
      if (u_filter_operator == 0) { // and
        display = conductivityInRange && lithologySelected;
      } else if (u_filter_operator == 1) { // or
        display = conductivityInRange || lithologySelected;
      } else if (u_filter_operator == 2) { // xor
        display = conductivityInRange != lithologySelected;
      }

      if (display) {
        vec3 voxelNormal = czm_normal * fsInput.voxel.surfaceNormal;
        float diffuse = max(0.0, dot(voxelNormal, czm_lightDirectionEC));
        float lighting = 0.5 + 0.5 * diffuse;
        if (value == u_undefined_data) {
          material.diffuse = vec3(0.797, 0.797, 0.797) * lighting;
        } else {
          float lerp = (value - u_min) / (u_max - u_min);
          material.diffuse = texture(u_colorRamp, vec2(lerp, 0.5)).rgb * lighting;
        }
        material.alpha = 1.0;
      }
    }
  `;

  const colors = config.voxelColors;
  const colorRamp = createColorRamp(colors.colors);

  return new CustomShader({
    fragmentShaderText: fragmentShaderText,
    uniforms: {
      u_colorRamp: {
        type: UniformType.SAMPLER_2D,
        value: new TextureUniform({
          typedArray: colorRamp.image,
          width: colorRamp.width,
          height: colorRamp.height,
        }),
      },
      u_min: {
        type: UniformType.FLOAT,
        value: colors.range[0],
      },
      u_max: {
        type: UniformType.FLOAT,
        value: colors.range[1],
      },
      u_filter_conductivity_min: {
        type: UniformType.FLOAT,
        value: config.voxelFilter.conductivityRange[0],
      },
      u_filter_conductivity_max: {
        type: UniformType.FLOAT,
        value: config.voxelFilter.conductivityRange[1],
      },
      u_filter_lithology_exclude: {
        type: UniformType.INT,
        value: 0,
      },
      u_filter_operator: {
        type: UniformType.INT,
        value: 0,
      },
      u_noData: {
        type: UniformType.FLOAT,
        value: colors.noData,
      },
      u_undefined_data: {
        type: UniformType.FLOAT,
        value: colors.undefinedData,
      },
      u_filter_include_undefined_conductivity: {
        type: UniformType.BOOL,
        value: true,
      },
    },
  });
}

function createSimpleCustomShader(config): CustomShader {
  const fragmentShaderText = `
    void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
      float value = fsInput.metadata.${config.voxelDataName};

      bool valueInRange = value >= u_filter_min && value <= u_filter_max;

      if (valueInRange && value != u_noData) {
        vec3 voxelNormal = czm_normal * fsInput.voxel.surfaceNormal;
        float diffuse = max(0.0, dot(voxelNormal, czm_lightDirectionEC));
        float lighting = 0.5 + 0.5 * diffuse;
        float lerp = (value - u_min) / (u_max - u_min);
        material.diffuse = texture(u_colorRamp, vec2(lerp, 0.5)).rgb * lighting;
        material.alpha = 1.0;
      }
    }
  `;

  const colors = config.voxelColors;
  const colorRamp = createColorRamp(colors.colors);
  const min = colors.range[0];
  const max = colors.range[1];

  return new CustomShader({
    fragmentShaderText: fragmentShaderText,
    uniforms: {
      u_colorRamp: {
        type: UniformType.SAMPLER_2D,
        value: new TextureUniform({
          typedArray: colorRamp.image,
          width: colorRamp.width,
          height: colorRamp.height,
        }),
      },
      u_min: {
        type: UniformType.FLOAT,
        value: min,
      },
      u_max: {
        type: UniformType.FLOAT,
        value: max,
      },
      u_filter_min: {
        type: UniformType.FLOAT,
        value: min,
      },
      u_filter_max: {
        type: UniformType.FLOAT,
        value: max,
      },
      u_noData: {
        type: UniformType.FLOAT,
        value: colors.noData,
      },
    },
  });
}

function createColorRamp(colors: string[]): ColorRamp {
  const ramp = document.createElement('canvas');
  ramp.width = 128;
  ramp.height = 1;
  const ctx = ramp.getContext('2d')!;
  const grd = ctx.createLinearGradient(0, 0, ramp.width, 0);

  const length = colors.length;
  const step = 1 / (length - 1);
  for (let i = 0; i < length; i++) {
    const color = colors[i];
    grd.addColorStop(i * step, color !== null ? colors[i] : 'rgba(0, 0, 0, 0)');
  }

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, ramp.width, ramp.height);

  const imageData = ctx.getImageData(0, 0, ramp.width, ramp.height);
  return {
    image: new Uint8Array(imageData.data.buffer),
    width: ramp.width,
    height: ramp.height,
  };
}


const shaders: Record<string, CustomShader> = {};
export function getVoxelShader(config): CustomShader {
  let shader = shaders[config.layer];
  if (!shader) {
    shader = shaders[config.layer] = config.voxelFilter ? createCustomShader(config) : createSimpleCustomShader(config);
  }
  return shader;
}
