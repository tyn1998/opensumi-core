/**
 * Terminal Client Test
 */
import * as WebSocket from 'ws';
import * as httpProxy from 'http-proxy';
import { createProxyServer, createWsServer, resetPort } from './proxy';
import {
  defaultName,
} from './mock.service';
import { ITerminalClientFactory, ITerminalGroupViewService, ITerminalClient, IWidget } from '../../src/common';
import { delay } from './utils';
import { injector } from './inject';

function createDOMContainer() {
  const div = document.createElement('div');
  div.style.width = '400px';
  div.style.height = '400px';
  document.body.appendChild(div);
  return div;
}

describe('Terminal Client', () => {
  let client: ITerminalClient;
  let widget: IWidget;
  let proxy: httpProxy;
  let server: WebSocket.Server;
  let view: ITerminalGroupViewService;
  let factory: ITerminalClientFactory;

  beforeAll(() => {
    resetPort();
    factory = injector.get(ITerminalClientFactory);
    view = injector.get(ITerminalGroupViewService);
    server = createWsServer();
    proxy = createProxyServer();
  });

  it('Not Ready To Show it', () => {
    const index = view.createGroup();
    const group = view.getGroup(index);
    widget = view.createWidget(group);
    client = factory(widget, {}, false);
    expect(client.ready).toBeFalsy();
  });

  it('Focus Terminal which is not ready', () => {
    try {
      client.focus();
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it('Render Terminal', async (done) => {
    widget.element = createDOMContainer();
    await client.attached.promise;
    expect(client.ready).toBeTruthy();
    done();
  });

  it('Terminal Pid And Name', () => {
    expect(client.name).toEqual(defaultName);
  });

  it('Focus Terminal which is ready', async () => {
    client.focus();
  });

  it('Terminal SelectAll', () => {
    client.selectAll();
    const position = client.term.getSelectionPosition();
    expect(position && position.endColumn)
      .toEqual(client.term.cols);
  });

  it.skip('Terminal Send Text', async (done) => {
    await client.attached.promise;
    client.clear();
    await client.sendText('pwd\r');
    await delay(500);

    const line = client.term.buffer.active.getLine(0);
    const lineText = (line && line.translateToString()) || '';
    expect(lineText.trim().length).toBeGreaterThan(0);
    done();
  });

  it.skip('Terminal Find Next', async () => {
    const searched = 'pwd';
    client.findNext(searched);
    expect(client.term.getSelection()).toEqual(searched);
  });

  it('Terminal Dispose', () => {
    client.dispose();

    expect(client.disposed).toBeTruthy();
    expect(client.container.children.length).toBe(0);
  });

  it('After Terminal Dispose', async (done) => {
    await client.attached.promise;
    client.sendText('pwd\r');
    client.focus();
    client.selectAll();
    client.updateTheme();
    client.clear();
    done();
  });

  afterAll(() => {
    client.dispose();
    server.close();
    proxy.close();
  });
});
