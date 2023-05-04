Configuration files for the cesium cli to generate the voxel data.

- Download the voxel cli
- Download the voxel csv data. If needed, adapt the path in configuration file.
- Update the date (`output.path`) in the configuration file
- Run the voxel cli (see the voxel cli documentation in `instructions.txt`)
- Upload the generated files to the s3 bucket: `s3://ngmpub-download-bgdi-ch/testvoxel/`
- Update the voxel urls in the `layertree.ts` file to include the new date.
