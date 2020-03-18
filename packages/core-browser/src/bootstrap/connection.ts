import {
  RPCServiceCenter,
  initRPCService,
  WSChannelHandler,
  createWebSocketConnection,
  createSocketConnection,
  RPCMessageConnection,
 } from '@ali/ide-connection';
import { Injector, Provider } from '@ali/common-di';
import { getDebugLogger, IReporterService, BasicModule, BrowserConnectionCloseEvent, BrowserConnectionOpenEvent, IEventBus } from '@ali/ide-core-common';
import { BackService } from '@ali/ide-core-common/lib/module';

import { ModuleConstructor } from './app';

// 建立连接之前，无法使用落盘的 logger
// 初始化时使用不落盘的 logger
const initialLogger = getDebugLogger();

export async function createClientConnection2(
  injector: Injector,
  modules: ModuleConstructor[],
  wsPath: string, onReconnect: () => void,
  protocols?: string[],
  useExperimentalMultiChannel?: boolean,
  clientId?: string,
) {
  const reporterService: IReporterService = injector.get(IReporterService);
  const eventBus = injector.get(IEventBus);

  const wsChannelHandler = new WSChannelHandler(wsPath, initialLogger, protocols, useExperimentalMultiChannel, clientId);
  wsChannelHandler.setReporter(reporterService);
  wsChannelHandler.connection.addEventListener('open', () => {
    eventBus.fire(new BrowserConnectionOpenEvent());
  });
  wsChannelHandler.connection.addEventListener('close', () => {
    eventBus.fire(new BrowserConnectionCloseEvent());
  });
  await wsChannelHandler.initHandler();

  injector.addProviders({
    token: WSChannelHandler,
    useValue: wsChannelHandler,
  });

  // 重连不会执行后面的逻辑
  const channel = await wsChannelHandler.openChannel('RPCService');
  channel.onReOpen(() => {
    /*
    for (const module of modules) {
      const moduleInstance = injector.get(module) as any;
      if (moduleInstance.providers) {
        const providers = moduleInstance.providers;
        for (const provider of providers) {

          // TODO: 最好是由 injector 自己拿到已经实例化的对象
          if (provider.token) {
            console.log('onReOpen provider.token', provider.token);
            try {
              const instance = injector.get(provider.token);

              if (instance.reConnectInit) {
                console.log('browser service reConnectInit', provider.token);
                instance.reConnectInit();
              }
            } catch (e) {
              console.log(e);
            }
          }
        }
      }
    }
    */

   onReconnect();
  });

  bindConnectionService(injector, modules, createWebSocketConnection(channel));
}

export async function createNetClientConnection(injector: Injector, modules: ModuleConstructor[], connection: any) {
  bindConnectionService(injector, modules, createSocketConnection(connection));
}

export async function bindConnectionService(injector: Injector, modules: ModuleConstructor[], connection: RPCMessageConnection) {
  const clientCenter = new RPCServiceCenter();
  clientCenter.setConnection(connection);

  const {
    getRPCService,
  } = initRPCService(clientCenter);

  const backServiceArr: BackService[] = [];

  for (const module of modules) {
    const moduleInstance = injector.get(module) as BasicModule;
    if (moduleInstance.backServices) {
      for (const backService of moduleInstance.backServices) {
        backServiceArr.push(backService);
      }
    }
  }

  for (const backService of backServiceArr) {
    const { servicePath } = backService;
    const rpcService = getRPCService(servicePath);

    const injectService = {
      token: servicePath,
      useValue: rpcService,
    } as Provider;

    injector.addProviders(injectService);

    if (backService.clientToken) {
      const clientService = injector.get(backService.clientToken);
      rpcService.onRequestService(clientService);
    }
  }
}
