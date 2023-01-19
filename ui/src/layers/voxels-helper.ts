import {CustomShader, TextureUniform, UniformType} from 'cesium';

type ColorRamp = {
  image: Uint8Array,
  width: number,
  height: number,
}


function createCustomShader(config): CustomShader {
  const colors = config.voxelColors;
  const colorRamp = createColorRamp(colors.colors);

  const min = colors.range[0];
  const max = colors.range[1];
  const noData = colors.noData;
  const lithology = config.voxelFilter?.lithology;

  let fragmentShaderText = '';
  if (lithology) {
    fragmentShaderText = `
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

        if (value == u_noData) {
          return;
        }

        bool valueInRange = value >= u_filter_min && value <= u_filter_max;

        bool lithologySelected = true;
        for (int i = 0; i < lithology_mapping_length; i++) {
          if (lithology == lithology_mapping[i] && bitSet(u_filter_lithology_exclude, i)) {
            lithologySelected = false;
            break;
          }
        }

        bool display = false;
        if (u_filter_operator == 0) { // and
          display = valueInRange && lithologySelected;
        } else if (u_filter_operator == 1) { // or
          display = valueInRange || lithologySelected;
        } else if (u_filter_operator == 2) { // xor
          display = valueInRange != lithologySelected;
        }

        if (display) {
          float lerp = (value - u_min) / (u_max - u_min);
          material.diffuse = texture2D(u_colorRamp, vec2(lerp, 0.5)).rgb;
          material.alpha = 1.0;
        }
      }`;
  } else {
    fragmentShaderText = `
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
      {
        float value = fsInput.metadata.${config.voxelDataName};

        if (value != u_noData && value >= u_filter_min && value <= u_filter_max) {
          float lerp = (value - u_min) / (u_max - u_min);
          material.diffuse = texture2D(u_colorRamp, vec2(lerp, 0.5)).rgb;
          material.alpha = 1.0;
        }
      }`;
  }

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
        value: noData,
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
    shader = shaders[config.layer] = createCustomShader(config);
  }
  return shader;
}
