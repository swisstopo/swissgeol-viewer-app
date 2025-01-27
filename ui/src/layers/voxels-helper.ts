import { CustomShader, PixelFormat, TextureUniform, UniformType } from 'cesium';
import { OBJECT_HIGHLIGHT_NORMALIZED_RGB } from '../constants';

type ColorConfig = {
  image: Uint8Array;
  width: number;
  height: number;
};

function createCustomShader(config): CustomShader {
  const lithology = config.voxelFilter.lithology;
  const colors = config.voxelColors;

  console.assert(config.noData === undefined, 'No data value must be defined');
  console.assert(
    config.undefinedData === undefined,
    'Undefined data value must be defined',
  );

  const fragmentShaderText = `
    void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
    {
      const int lithology_length = ${lithology.length};
      float lithology_mapping[lithology_length];
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

      float lithologyPixelWidth = 1.0 / float(lithology_length);

      int lithologyIndex = -1;
      for (int i = 0; i < lithology_length; i++) {
        if (lithology == lithology_mapping[i]) {
          lithologyIndex = i;
          float textureX = (float(i) / float(lithology_length)) + (lithologyPixelWidth / 2.0);
          lithologySelected = texture(u_filter_selected_lithology, vec2(textureX, 0.5)).a > 0.0;
          break;
        }
      }
      // ignore unhandled lithology values
      if (lithologyIndex == -1) {
        lithologySelected = false;
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
        vec3 voxelNormal = normalize(czm_normal * fsInput.voxel.surfaceNormal);
        float diffuse = max(0.0, dot(voxelNormal, czm_lightDirectionEC));
        float lighting = 0.5 + 0.5 * diffuse;
        if (fsInput.voxel.tileIndex == u_selectedTile && fsInput.voxel.sampleIndex == u_selectedSample) {
          material.diffuse = vec3(${OBJECT_HIGHLIGHT_NORMALIZED_RGB}) * lighting;
        } else if (u_us_color_index) {
          float textureX = (float(lithologyIndex) / float(lithology_length)) + (lithologyPixelWidth / 2.0);
          material.diffuse = texture(u_colorRamp, vec2(textureX, 0.5)).rgb * lighting;
        } else if (value == u_undefined_data) {
          material.diffuse = vec3(0.797, 0.797, 0.797) * lighting;
        } else {
          float lerp = (value - u_min) / (u_max - u_min);
          material.diffuse = texture(u_colorRamp, vec2(lerp, 0.5)).rgb * lighting;
        }
        material.alpha = 1.0;
      }
    }
  `;

  const useColorIndex = config.voxelDataName === 'Index';
  if (useColorIndex) {
    console.assert(
      colors.colors.length === lithology.length,
      'Color index mode requires the same number of colors as lithology types',
    );
  }
  const colorRamp = useColorIndex
    ? createColorIndex(colors.colors)
    : createColorGradient(colors.colors);

  return new CustomShader({
    fragmentShaderText: fragmentShaderText,
    uniforms: {
      u_colorRamp: {
        type: UniformType.SAMPLER_2D,
        value: new TextureUniform({
          typedArray: colorRamp.image,
          repeat: false,
          width: colorRamp.width,
          height: colorRamp.height,
        }),
      },
      u_us_color_index: {
        type: UniformType.BOOL,
        value: useColorIndex,
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
      u_filter_selected_lithology: {
        type: UniformType.SAMPLER_2D,
        value: createLithologyIncludeUniform(Array(lithology.length).fill(1)),
      },
      u_selectedTile: {
        type: UniformType.INT,
        value: -1.0,
      },
      u_selectedSample: {
        type: UniformType.INT,
        value: -1.0,
      },
    },
  });
}

function createSimpleCustomShader(config): CustomShader {
  const fragmentShaderText = `
  void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
    {
        float value = fsInput.metadata.${config.voxelDataName};
    
        vec3 voxelNormal = normalize(czm_normal * fsInput.voxel.surfaceNormal);
        float diffuse = max(0.0, dot(voxelNormal, czm_lightDirectionEC));
        float lighting = 0.5 + 0.5 * diffuse;
        
        bool valueInRange = value >= u_filter_min && value <= u_filter_max;
    
        if (fsInput.voxel.tileIndex == u_selectedTile && fsInput.voxel.sampleIndex == u_selectedSample) {
          material.diffuse = vec3(${OBJECT_HIGHLIGHT_NORMALIZED_RGB}) * lighting;
          material.alpha = 1.0;
        } else if (valueInRange && value != u_noData) {
            float lerp = (value - u_min) / (u_max - u_min);
            material.diffuse = texture(u_colorRamp, vec2(lerp, 0.5)).rgb * lighting;
            material.alpha = 1.0;
        }
    }
  `;

  const colors = config.voxelColors;
  const colorRamp = createColorGradient(colors.colors);
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
      u_selectedTile: {
        type: UniformType.INT,
        value: -1.0,
      },
      u_selectedSample: {
        type: UniformType.INT,
        value: -1.0,
      },
    },
  });
}

function createColorGradient(colors: string[]): ColorConfig {
  const ramp = document.createElement('canvas');
  ramp.width = 128;
  ramp.height = 1;
  const ctx = ramp.getContext('2d')!;
  const grd = ctx.createLinearGradient(0, 0, ramp.width, 0);

  const length = colors.length;
  const step = 1 / (length - 1);
  for (let i = 0; i < length; i++) {
    grd.addColorStop(i * step, colors[i]);
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

function createColorIndex(colors: string[]): ColorConfig {
  const canvas = document.createElement('canvas');
  canvas.width = colors.length;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;

  for (let i = 0; i < colors.length; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(i, 0, 1, 1);
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    image: new Uint8Array(imageData.data.buffer),
    width: canvas.width,
    height: canvas.height,
  };
}

const shaders: Record<string, CustomShader> = {};
export function getVoxelShader(config): CustomShader {
  let shader = shaders[config.layer];
  if (!shader) {
    shader = shaders[config.layer] = config.voxelFilter
      ? createCustomShader(config)
      : createSimpleCustomShader(config);
  }
  return shader;
}

export function createLithologyIncludeUniform(arr: number[]): TextureUniform {
  return new TextureUniform({
    typedArray: new Uint8Array(arr),
    pixelFormat: PixelFormat.ALPHA,
    repeat: false,
    width: arr.length,
    height: 1,
  });
}
