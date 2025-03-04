import { Autowired } from '@opensumi/di';
import { ClientAppContribution, getIcon, PreferenceContribution } from '@opensumi/ide-core-browser';
import { OUTPUT_CONTAINER_ID } from '@opensumi/ide-core-browser/lib/common/container-id';
import {
  ComponentContribution,
  ComponentRegistry,
  TabBarToolbarContribution,
  ToolbarRegistry,
} from '@opensumi/ide-core-browser/lib/layout';
import {
  Disposable,
  CommandContribution,
  CommandRegistry,
  Command,
  localize,
  PreferenceSchema,
  CommonLanguageId,
} from '@opensumi/ide-core-common';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { OutputLinkProvider } from './output-link.provider';
import { outputPreferenceSchema } from './output-preference';
import { OutputService } from './output.service';
import { Output, ChannelSelector } from './output.view';

const OUTPUT_CLEAR: Command = {
  id: 'output.channel.clear',
  label: '%output.channel.clear%',
};

@Domain(
  CommandContribution,
  ComponentContribution,
  TabBarToolbarContribution,
  PreferenceContribution,
  ClientAppContribution,
)
export class OutputContribution
  extends Disposable
  implements
    CommandContribution,
    ComponentContribution,
    TabBarToolbarContribution,
    PreferenceContribution,
    ClientAppContribution
{
  @Autowired()
  private readonly outputService: OutputService;

  @Autowired()
  private readonly outputLinkProvider: OutputLinkProvider;

  schema: PreferenceSchema = outputPreferenceSchema;

  onStart() {
    this.addDispose(monaco.languages.registerLinkProvider(CommonLanguageId.Log, this.outputLinkProvider));
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: 'output.clear.action',
      command: OUTPUT_CLEAR.id,
      iconClass: getIcon('clear'),
      viewId: OUTPUT_CONTAINER_ID,
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(OUTPUT_CLEAR, {
      execute: () => this.outputService.selectedChannel?.clear(),
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register(
      '@opensumi/ide-output',
      {
        id: OUTPUT_CONTAINER_ID,
        component: Output,
      },
      {
        title: localize('output.tabbar.title'),
        priority: 9,
        containerId: OUTPUT_CONTAINER_ID,
        activateKeyBinding: 'ctrlcmd+shift+u',
        titleComponent: ChannelSelector,
      },
    );
  }
}
