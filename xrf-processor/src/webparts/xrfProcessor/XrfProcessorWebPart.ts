import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneDropdown,
  PropertyPaneLabel
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

// PnP JS imports
import { spfi, SPFI, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/files";
import "@pnp/sp/folders";

import * as strings from 'XrfProcessorWebPartStrings';
import XrfProcessor from './components/XrfProcessor';
import { IXrfProcessorProps } from './components/IXrfProcessorProps';
import { initializeServices } from './services/ServiceFactory';
import { initializeOpenAIService } from './services/OpenAIService';
import { initializeAIColumnMapper } from './services/AIColumnMapperService';
import { AIProvider } from './config/OpenAIConfig';

export interface IXrfProcessorWebPartProps {
  description: string;
  // OpenAI Configuration
  openAIProvider: AIProvider;
  openAIApiKey: string;
  openAIModel: string;
  // Azure OpenAI specific
  azureOpenAIEndpoint: string;
  azureOpenAIApiVersion: string;
}

export default class XrfProcessorWebPart extends BaseClientSideWebPart<IXrfProcessorWebPartProps> {

  private _isDarkTheme: boolean = false;
  private _environmentMessage: string = '';
  private _sp: SPFI = undefined!;

  public render(): void {
    const element: React.ReactElement<IXrfProcessorProps> = React.createElement(
      XrfProcessor,
      {
        sp: this._sp,
        description: this.properties.description,
        isDarkTheme: this._isDarkTheme,
        environmentMessage: this._environmentMessage,
        hasTeamsContext: !!this.context.sdks.microsoftTeams,
        userDisplayName: this.context.pageContext.user.displayName
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected onInit(): Promise<void> {
    // Initialize PnP JS
    this._sp = spfi().using(SPFx(this.context));
    
    // Initialize service factory for global access
    initializeServices(this._sp);
    
    // Initialize OpenAI services with web part properties
    this._initializeAIServices();
    
    return this._getEnvironmentMessage().then(message => {
      this._environmentMessage = message;
    });
  }

  /**
   * Initialize AI services with current property values
   */
  private _initializeAIServices(): void {
    const openAIConfig = {
      provider: this.properties.openAIProvider || 'openai',
      apiKey: this.properties.openAIApiKey || '',
      model: this.properties.openAIModel || 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 2000,
      openaiBaseUrl: 'https://api.openai.com/v1',
      azureEndpoint: this.properties.azureOpenAIEndpoint || '',
      azureApiVersion: this.properties.azureOpenAIApiVersion || '2024-02-15-preview',
    };

    // Initialize both OpenAI services
    initializeOpenAIService(openAIConfig);
    initializeAIColumnMapper(openAIConfig);
  }

  /**
   * Re-initialize services when properties change
   */
  protected onPropertyPaneFieldChanged(propertyPath: string, oldValue: unknown, newValue: unknown): void {
    super.onPropertyPaneFieldChanged(propertyPath, oldValue, newValue);

    // Reinitialize AI services if any OpenAI property changed
    if (propertyPath.startsWith('openAI') || propertyPath.startsWith('azure')) {
      this._initializeAIServices();
    }
  }

  private _getEnvironmentMessage(): Promise<string> {
    if (!!this.context.sdks.microsoftTeams) { // running in Teams, office.com or Outlook
      return this.context.sdks.microsoftTeams.teamsJs.app.getContext()
        .then(context => {
          let environmentMessage: string = '';
          switch (context.app.host.name) {
            case 'Office': // running in Office
              environmentMessage = this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentOffice : strings.AppOfficeEnvironment;
              break;
            case 'Outlook': // running in Outlook
              environmentMessage = this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentOutlook : strings.AppOutlookEnvironment;
              break;
            case 'Teams': // running in Teams
            case 'TeamsModern':
              environmentMessage = this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentTeams : strings.AppTeamsTabEnvironment;
              break;
            default:
              environmentMessage = strings.UnknownEnvironment;
          }

          return environmentMessage;
        });
    }

    return Promise.resolve(this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentSharePoint : strings.AppSharePointEnvironment);
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    this._isDarkTheme = !!currentTheme.isInverted;
    const {
      semanticColors
    } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || null);
      this.domElement.style.setProperty('--link', semanticColors.link || null);
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || null);
    }

  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    const isAzure = this.properties.openAIProvider === 'azure';

    return {
      pages: [
        {
          header: {
            description: 'Configure the XRF Lead Paint Processor web part settings.'
          },
          groups: [
            {
              groupName: 'General Settings',
              groupFields: [
                PropertyPaneTextField('description', {
                  label: 'Description'
                })
              ]
            },
            {
              groupName: 'AI Configuration',
              groupFields: [
                PropertyPaneDropdown('openAIProvider', {
                  label: 'AI Provider',
                  options: [
                    { key: 'openai', text: 'OpenAI' },
                    { key: 'azure', text: 'Azure OpenAI' }
                  ],
                  selectedKey: this.properties.openAIProvider || 'openai'
                }),
                PropertyPaneTextField('openAIApiKey', {
                  label: 'API Key',
                  description: isAzure ? 'Your Azure OpenAI API key' : 'Your OpenAI API key (starts with sk-)',
                }),
                PropertyPaneTextField('openAIModel', {
                  label: isAzure ? 'Deployment Name' : 'Model',
                  description: isAzure ? 'Your Azure OpenAI deployment name' : 'e.g., gpt-4o-mini, gpt-4o'
                }),
                // Azure-specific fields
                ...(isAzure ? [
                  PropertyPaneTextField('azureOpenAIEndpoint', {
                    label: 'Azure Endpoint',
                    description: 'e.g., https://your-resource.openai.azure.com'
                  }),
                  PropertyPaneTextField('azureOpenAIApiVersion', {
                    label: 'API Version',
                    description: 'e.g., 2024-02-15-preview'
                  })
                ] : []),
                PropertyPaneLabel('apiKeyWarning', {
                  text: '⚠️ API keys are stored in web part properties. For production, consider using Azure Key Vault.'
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
