Configuration files for the cesium cli to generate the voxel data.

- Download the voxel cli
- Download the voxel csv data.
  ```bash
  export AWS_ACCESS_KEY_ID=$(gopass cat ngm/s3/databucket/AWS_PUBLIC_KEY)
  export AWS_SECRET_ACCESS_KEY=$(gopass cat ngm/s3/databucket/AWS_SECRET_KEY)
  aws s3 sync s3://ngm-data-exchange/DataReadyToIntegrate/<path_to_data>/ .
  ```
- If needed, adapt the path in configuration file.
- Update the date (`output.path`) in the configuration file
- Run the voxel cli (see the voxel cli documentation in `instructions.txt`)
- Upload the generated files to the s3 bucket: `s3://ngmpub-download-bgdi-ch/testvoxel/`
  ```bash
  export AWS_ACCESS_KEY_ID=$(gopass cat ngm/s3/ngmpub-download-bgdi-ch/AWS_ACCESS_KEY_ID)
  export AWS_SECRET_ACCESS_KEY=$(gopass cat ngm/s3/ngmpub-download-bgdi-ch/AWS_SECRET_ACCESS_KEY)
  aws s3 sync output s3://ngmpub-download-bgdi-ch/testvoxel/
  ```
- Update the voxel urls in the `layertree.ts` file to include the new date.
