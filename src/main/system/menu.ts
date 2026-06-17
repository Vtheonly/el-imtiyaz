/**
 * Application menu — provides accelerator-driven navigation for power users.
 *
 * The menu is intentionally minimal: it routes commands back to the renderer
 * via the global `menu:command` channel, where the React layer decides what
 * to do. This keeps menu items declarative and avoids scattering business
 * logic inside Electron.
 */

import { Menu, BrowserWindow, MenuItemConstructorOptions, shell } from 'electron';
import { logger } from '../../infrastructure/logger/logger';

export interface MenuCommand {
  id: string;
  payload?: unknown;
}

const send = (command: MenuCommand) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) {
    logger.warn('menu.command.no-window', { id: command.id });
    return;
  }
  win.webContents.send('menu:command', command);
};

export function buildApplicationMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Student',
          accelerator: 'CmdOrCtrl+N',
          click: () => send({ id: 'students:new' })
        },
        {
          label: 'New Payment',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => send({ id: 'payments:new' })
        },
        { type: 'separator' },
        {
          label: 'Import Students…',
          accelerator: 'CmdOrCtrl+I',
          click: () => send({ id: 'students:import' })
        },
        {
          label: 'Export Current View…',
          accelerator: 'CmdOrCtrl+E',
          click: () => send({ id: 'export:current' })
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => send({ id: 'navigate', payload: '/dashboard' })
        },
        {
          label: 'Students',
          accelerator: 'CmdOrCtrl+2',
          click: () => send({ id: 'navigate', payload: '/students' })
        },
        {
          label: 'Payments',
          accelerator: 'CmdOrCtrl+3',
          click: () => send({ id: 'navigate', payload: '/payments' })
        },
        {
          label: 'Debt Dashboard',
          accelerator: 'CmdOrCtrl+4',
          click: () => send({ id: 'navigate', payload: '/debt' })
        },
        {
          label: 'Reports',
          accelerator: 'CmdOrCtrl+5',
          click: () => send({ id: 'navigate', payload: '/reports' })
        },
        {
          label: 'Audit Logs',
          accelerator: 'CmdOrCtrl+6',
          click: () => send({ id: 'navigate', payload: '/audit' })
        },
        {
          label: 'Workflows',
          accelerator: 'CmdOrCtrl+7',
          click: () => send({ id: 'navigate', payload: '/workflows' })
        },
        {
          label: 'Notifications',
          accelerator: 'CmdOrCtrl+8',
          click: () => send({ id: 'navigate', payload: '/notifications' })
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Command Palette',
          accelerator: 'CmdOrCtrl+K',
          click: () => send({ id: 'command-palette:open' })
        },
        {
          label: 'Global Search',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => send({ id: 'search:open' })
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => send({ id: 'navigate', payload: '/settings' })
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Logs Folder',
          click: () => {
            const { AppPaths } = require('./app-paths');
            const paths = AppPaths.resolve();
            shell.openPath(paths.logs);
          }
        },
        {
          label: 'Open Data Folder',
          click: () => {
            const { AppPaths } = require('./app-paths');
            const paths = AppPaths.resolve();
            shell.openPath(paths.userData);
          }
        },
        { type: 'separator' },
        {
          label: 'About El-Imtiyaz',
          click: () => send({ id: 'about:open' })
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}
