import { vscAuthority } from './const';

export const themeDefaultExtContributes = {
  extPath: vscAuthority + '/theme-defaults',
  pkgJSON: {
    'contributes': {
      'themes': [
        {
          'id': 'Default Dark+',
          'label': 'Dark+ (default dark)',
          'uiTheme': 'vs-dark',
          'path': './themes/dark_plus.json',
        },
        {
          'id': 'Default Light+',
          'label': 'Light+ (default light)',
          'uiTheme': 'vs',
          'path': './themes/light_plus.json',
        },
        {
          'id': 'Visual Studio Dark',
          'label': 'Dark (Visual Studio)',
          'uiTheme': 'vs-dark',
          'path': './themes/dark_vs.json',
        },
        {
          'id': 'Visual Studio Light',
          'label': 'Light (Visual Studio)',
          'uiTheme': 'vs',
          'path': './themes/light_vs.json',
        },
        {
          'id': 'Default High Contrast',
          'label': 'High Contrast',
          'uiTheme': 'hc-black',
          'path': './themes/hc_black.json',
        },
      ],
      'iconThemes': [
        {
          'id': 'vs-minimal',
          'label': 'Minimal (Visual Studio Code)',
          'path': './fileicons/vs_minimal-icon-theme.json',
        },
      ],
    },
  },
};
