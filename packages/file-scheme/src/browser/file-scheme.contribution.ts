import { ResourceService, IResource, IEditorOpenType } from '@ali/ide-editor';
import { URI, Domain, localize, LRUMap, Schemas, PreferenceService } from '@ali/ide-core-browser';
import { Autowired } from '@ali/common-di';
import { getLanguageIdFromMonaco } from '@ali/ide-core-browser/lib/services';
import { EditorComponentRegistry, BrowserEditorContribution, IEditorDocumentModelContentRegistry } from '@ali/ide-editor/lib/browser';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';

import { ImagePreview } from './preview.view';
import { BinaryEditorComponent } from './external.view';
import { FILE_SCHEME } from '../common';
import { FileSchemeDocumentProvider, DebugSchemeDocumentProvider, VscodeSchemeDocumentProvider } from './file-doc';
import { UntitledSchemeResourceProvider, UntitledSchemeDocumentProvider } from '@ali/ide-editor/lib/browser/untitled-resource';
import { LargeFilePrevent } from './prevent.view';
import { FileSystemResourceProvider, DebugResourceProvider } from './file-resource';

const IMAGE_PREVIEW_COMPONENT_ID = 'image-preview';
const EXTERNAL_OPEN_COMPONENT_ID = 'external-file';
const LARGE_FILE_PREVENT_COMPONENT_ID = 'large-file-prevent';

@Domain(BrowserEditorContribution)
export class FileSystemEditorResourceContribution implements BrowserEditorContribution {
  @Autowired()
  private readonly fileSystemResourceProvider: FileSystemResourceProvider;

  @Autowired()
  private readonly fileSchemeDocumentProvider: FileSchemeDocumentProvider;

  @Autowired()
  private readonly debugSchemeResourceProvider: DebugResourceProvider;

  @Autowired()
  private readonly debugSchemeDocumentProvider: DebugSchemeDocumentProvider;

  @Autowired()
  private readonly vscodeSchemeDocumentProvider: VscodeSchemeDocumentProvider;

  @Autowired()
  private readonly untitledResourceProvider: UntitledSchemeResourceProvider;

  @Autowired()
  private readonly untitledSchemeDocumentProvider: UntitledSchemeDocumentProvider;

  registerResource(resourceService: ResourceService) {
    // 注册 provider 处理 file scheme 对应的 icon/meta 等信息
    resourceService.registerResourceProvider(this.fileSystemResourceProvider);
    resourceService.registerResourceProvider(this.debugSchemeResourceProvider);
    resourceService.registerResourceProvider(this.untitledResourceProvider);
  }

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    // 注册 provider 提供 doc / 文档的内容和 meta 信息
    registry.registerEditorDocumentModelContentProvider(this.fileSchemeDocumentProvider);
    registry.registerEditorDocumentModelContentProvider(this.debugSchemeDocumentProvider);
    registry.registerEditorDocumentModelContentProvider(this.vscodeSchemeDocumentProvider);
    registry.registerEditorDocumentModelContentProvider(this.untitledSchemeDocumentProvider);
  }
}

@Domain(BrowserEditorContribution)
export class FileSystemEditorComponentContribution implements BrowserEditorContribution {
  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(PreferenceService)
  private readonly preference: PreferenceService;

  private cachedFileType = new LRUMap<string, string | undefined>(200, 100);

  constructor() {
    this.fileServiceClient.onFilesChanged((e) => {
      e.forEach((change) => {
        this.cachedFileType.delete(change.uri.toString());
      });
    });
  }

  registerEditorComponent(editorComponentRegistry: EditorComponentRegistry) {
    editorComponentRegistry.registerEditorComponent({
      component: ImagePreview,
      uid: IMAGE_PREVIEW_COMPONENT_ID,
      scheme: FILE_SCHEME,
    });

    editorComponentRegistry.registerEditorComponent({
      component: BinaryEditorComponent,
      uid: EXTERNAL_OPEN_COMPONENT_ID,
      scheme: FILE_SCHEME,
    });

    editorComponentRegistry.registerEditorComponent({
      component: LargeFilePrevent,
      uid: LARGE_FILE_PREVENT_COMPONENT_ID,
      scheme: FILE_SCHEME,
    });

    // 如果文件无法在当前IDE编辑器中找到打开方式
    editorComponentRegistry.registerEditorComponentResolver((scheme: string) => {
      return (scheme === FILE_SCHEME || this.fileServiceClient.handlesScheme(scheme)) ? 10 : -1;
    }, (resource: IResource<any>, results: IEditorOpenType[]) => {
      if (results.length === 0) {
        results.push({
          type: 'component',
          componentId: EXTERNAL_OPEN_COMPONENT_ID,
        });
      }
    });

    // 图片文件
    editorComponentRegistry.registerEditorComponentResolver((scheme: string) => {
      return (scheme === FILE_SCHEME || this.fileServiceClient.handlesScheme(scheme)) ? 10 : -1;
    }, async (resource: IResource<any>, results: IEditorOpenType[]) => {
      const type = await this.getFileType(resource.uri.toString());

      if (type === 'image') {
        results.push({
          type: 'component',
          componentId: IMAGE_PREVIEW_COMPONENT_ID,
        });
      }

      if (type === 'text') {
        const { metadata, uri } = resource as { uri: URI, metadata: any };
        const stat = await this.fileServiceClient.getFileStat(uri.toString());
        const maxSize = this.preference.get<number>('editor.largeFile') || 20000;

        if (stat && (stat.size || 0) > maxSize && !(metadata || {}).noPrevent) {
          results.push({
            type: 'component',
            componentId: LARGE_FILE_PREVENT_COMPONENT_ID,
          });
        } else {
          results.push({
            type: 'code',
            title: localize('editorOpenType.code'),
          });
        }
      }
    });

    editorComponentRegistry.registerEditorComponentResolver('debug', (resource: IResource<any>, results: IEditorOpenType[]) => {
      if (results.length === 0) {
        results.push({
          type: 'code',
          title: localize('editorOpenType.code'),
        });
      }
    });

    editorComponentRegistry.registerEditorComponentResolver(Schemas.untitled, (resource: IResource<any>, results: IEditorOpenType[]) => {
      if (results.length === 0) {
        results.push({
          type: 'code',
        });
      }
    });
  }

  private async getFileType(uri: string): Promise<string | undefined> {
    if (!this.cachedFileType.has(uri)) {
      if (getLanguageIdFromMonaco(new URI(uri))) {
        // 对于已知 language 对应扩展名的文件，当 text 处理
        this.cachedFileType.set(uri, 'text');
      } else {
        this.cachedFileType.set(uri, await this.getRealFileType(uri));
      }
    }
    return this.cachedFileType.get(uri);
  }

  private async getRealFileType(uri: string) {
    try {
      return await this.fileServiceClient.getFileType(uri);
    } catch (err) {
      // 沿用之前设计，继续使用 `text` 作为返回值
      return 'text';
    }
  }
}
