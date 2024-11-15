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

Main prefixes:
* tbx... = toobox
* lyr... = layertree
* nav... = navigation part
* dtd... = displayed data
* lsb... = left side bar

Small parts prefixes:
* disclaimer... = disclaimer
* header... = page header content
* obj_info... = object info window
* sentry... = sentry popup
* slow_connection... = slow connection popup
* welcome... = left side bar welcome part

Suffixes:
* ...label = the string of a label (or ...btn_label)
* ...hint = hint/tooltip text (or ...btn_hint)
