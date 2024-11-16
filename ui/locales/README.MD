# Update translations

## 1) Run i18next-scanner
- Change to `swissgeol-viewer-app/ui`:
```bash
cd swissgeol-viewer-app/ui
```
- (*optional*) Modifiy configuration:  
Edit `swissgeol-viewer-app/ui/i18next-scanner.config.cjs`

- run scanner:
```bash
npx i18next-scanner --config i18next-scanner.config.cjs
```

## 2) Run script to campare and combine translations
- Change to `swissgeol-viewer-app/ui/scripts/updateLocales`:
```bash
cd swissgeol-viewer-app/ui/scripts/updateLocales
``` 

- Run script
```bash
./updateLocales.py
```

###### Prefixes / suffixes explanation:

Prefixes:
* app... = general ui elements
* cam... *and* camera... = camera configuration panel
* dashboard... = dashboard and user projects panel (cf. "project...")
* disclaimer... = disclaimer link and text
* dtd... = displayed data
* header... = page header content
* lsb... = left side bar
* lyr... = layertree
* map... = right-click info panel (position of selected location)
* nav... *and*  navigation... = navigation part
* obj_info... = object info window
* profile... = topografic profile  (cf. "topographic_profile...")
* project... = projects panel  (cf. "dashboard...")
* sentry... = sentry popup
* shortlink... = Sharing panel
* slow_connection... = slow connection popup
* tbx... = toobox
* topographic_profile... = topografic profile (cf. "profile...")
* tracking... = Tracking and disclaimer opt-out panel
* vox... = Voxel data and filter panel
* welcome... = left side bar welcome part

Suffixes:
* ...label = the string of a label (or ...btn_label)
* ...hint = hint/tooltip text (or ...btn_hint)
