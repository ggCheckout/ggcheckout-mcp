import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class GGCheckoutApi implements ICredentialType {
  name = "ggcheckoutApi";
  displayName = "GG Checkout API";
  documentationUrl = "https://docs.ggcheckout.com";
  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description: "Your GG Checkout API key (starts with ggck_live_)",
    },
    {
      displayName: "API URL",
      name: "apiUrl",
      type: "string",
      default: "https://www.ggcheckout.com",
      required: true,
      description: "GG Checkout API base URL",
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: {
        Authorization: "=Bearer {{$credentials.apiKey}}",
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.apiUrl}}",
      url: "/api/v1/user/business",
      method: "GET",
    },
  };
}
