import { ElectronMainApiRegistry, IElectronMainApiProvider, IElectronMainApp } from './types';
import { IDisposable, Disposable, getDebugLogger } from '@ali/ide-core-common';
import { ipcMain } from 'electron';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';

@Injectable()
export class ElectronMainApiRegistryImpl implements ElectronMainApiRegistry {

  private apis: Map<string, ElectronMainApiProxy> = new Map();

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  constructor() {

  }

  registerMainApi(name: string, api: IElectronMainApiProvider): IDisposable {

    if (this.apis.has(name)) {
      this.apis.get(name)!.dispose();
    }
    const proxy = this.injector.get(ElectronMainApiProxy, [name, api]);
    getDebugLogger().log('注册Electron Main Api: ' + name);
    this.apis.set(name, proxy);

    return {
      dispose: () => {
        if (this.apis.get(name) === proxy) {
          this.apis.delete(name);
        }
        proxy.dispose();
      },
    };

  }

}

@Injectable({multiple: true})
export class ElectronMainApiProxy extends Disposable {

  @Autowired(IElectronMainApp)
  app: IElectronMainApp;

  constructor(name: string, target: IElectronMainApiProvider) {
    super();
    const requestHandler = async (event, method: string, requestId: number, ...args: any[]) => {
      try {
        if (!target[method] || typeof target[method] !== 'function') {
          throw new Error(`No Request Handler for ${name}.${method}`);
        }
        const result = await target[method].apply(target, args);
        event.sender.send('response:' + name, requestId, undefined, result);
      } catch (e) {
        getDebugLogger().error(e);
        const err = {
          message: e.message || e.toString(),
          stack: e.stack,
        };
        event.sender.send('response:' + name, requestId, err);
      }
    };
    ipcMain.on('request:' + name, requestHandler);

    target.eventEmitter = {
      fire: (event: string, ...args: any[]) => {
        this.app.getCodeWindows().forEach((window) => {
          window.getBrowserWindow().webContents.send('event:' + name, event, ...args);
        });
      },
    };

    this.addDispose({
      dispose: () => {
        ipcMain.removeAllListeners('request:' + name);
      },
    });
  }

}
