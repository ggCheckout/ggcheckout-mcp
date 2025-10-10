import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from "n8n-workflow";

import axios from "axios";

export class GGCheckout implements INodeType {
  description: INodeTypeDescription = {
    displayName: "GG Checkout",
    name: "ggcheckout",
    icon: "file:ggcheckout.svg",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: "Interact with GG Checkout API",
    defaults: {
      name: "GG Checkout",
    },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [
      {
        name: "ggcheckoutApi",
        required: true,
      },
    ],
    requestDefaults: {
      baseURL: "={{$credentials.apiUrl}}",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        options: [
          {
            name: "Product",
            value: "product",
          },
          {
            name: "Payment",
            value: "payment",
          },
          {
            name: "Checkout",
            value: "checkout",
          },
          {
            name: "Webhook",
            value: "webhook",
          },
        ],
        default: "product",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ["product"],
          },
        },
        options: [
          {
            name: "List Products",
            value: "listProducts",
            description: "Get all products",
            action: "List products",
          },
          {
            name: "Get Product",
            value: "getProduct",
            description: "Get a specific product",
            action: "Get product",
          },
          {
            name: "Create Product",
            value: "createProduct",
            description: "Create a new product",
            action: "Create product",
          },
          {
            name: "Update Product",
            value: "updateProduct",
            description: "Update an existing product",
            action: "Update product",
          },
          {
            name: "Delete Product",
            value: "deleteProduct",
            description: "Delete a product",
            action: "Delete product",
          },
        ],
        default: "listProducts",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ["payment"],
          },
        },
        options: [
          {
            name: "List Payments",
            value: "listPayments",
            description: "Get all payments for a business",
            action: "List payments",
          },
          {
            name: "Get Payment",
            value: "getPayment",
            description: "Get a specific payment",
            action: "Get payment",
          },
          {
            name: "Get Paginated Payments",
            value: "getPaginatedPayments",
            description: "Get paginated payments with filters",
            action: "Get paginated payments",
          },
        ],
        default: "listPayments",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ["checkout"],
          },
        },
        options: [
          {
            name: "List Checkouts",
            value: "listCheckouts",
            description: "Get all checkout pages",
            action: "List checkouts",
          },
          {
            name: "Get Checkout",
            value: "getCheckout",
            description: "Get a specific checkout",
            action: "Get checkout",
          },
          {
            name: "Create Checkout",
            value: "createCheckout",
            description: "Create a new checkout page",
            action: "Create checkout",
          },
          {
            name: "Update Checkout",
            value: "updateCheckout",
            description: "Update an existing checkout",
            action: "Update checkout",
          },
          {
            name: "Delete Checkout",
            value: "deleteCheckout",
            description: "Delete a checkout",
            action: "Delete checkout",
          },
        ],
        default: "listCheckouts",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: ["webhook"],
          },
        },
        options: [
          {
            name: "List Webhooks",
            value: "listWebhooks",
            description: "Get all webhooks",
            action: "List webhooks",
          },
          {
            name: "Get Webhook",
            value: "getWebhook",
            description: "Get a specific webhook",
            action: "Get webhook",
          },
          {
            name: "Create Webhook",
            value: "createWebhook",
            description: "Create a new webhook",
            action: "Create webhook",
          },
          {
            name: "Update Webhook",
            value: "updateWebhook",
            description: "Update an existing webhook",
            action: "Update webhook",
          },
          {
            name: "Delete Webhook",
            value: "deleteWebhook",
            description: "Delete a webhook",
            action: "Delete webhook",
          },
        ],
        default: "listWebhooks",
      },
      // Product fields
      {
        displayName: "Product ID",
        name: "productId",
        type: "string",
        displayOptions: {
          show: {
            resource: ["product"],
            operation: ["getProduct", "updateProduct", "deleteProduct"],
          },
        },
        default: "",
        required: true,
        description: "The ID of the product",
      },
      {
        displayName: "Title",
        name: "title",
        type: "string",
        displayOptions: {
          show: {
            resource: ["product"],
            operation: ["createProduct", "updateProduct"],
          },
        },
        default: "",
        required: true,
        description: "Product title",
      },
      {
        displayName: "URL",
        name: "url",
        type: "string",
        displayOptions: {
          show: {
            resource: ["product"],
            operation: ["createProduct", "updateProduct"],
          },
        },
        default: "",
        required: true,
        description: "Product URL",
      },
      {
        displayName: "Description",
        name: "description",
        type: "string",
        displayOptions: {
          show: {
            resource: ["product"],
            operation: ["createProduct", "updateProduct"],
          },
        },
        default: "",
        description: "Product description",
      },
      {
        displayName: "Price",
        name: "price",
        type: "number",
        displayOptions: {
          show: {
            resource: ["product"],
            operation: ["createProduct", "updateProduct"],
          },
        },
        default: 0,
        description: "Price in cents (e.g., 1990 for R$19.90)",
      },
      {
        displayName: "Discount",
        name: "discount",
        type: "string",
        displayOptions: {
          show: {
            resource: ["product"],
            operation: ["createProduct", "updateProduct"],
          },
        },
        default: "",
        description: 'Discount information (e.g., "30%")',
      },
      {
        displayName: "Image URL",
        name: "imageUrl",
        type: "string",
        displayOptions: {
          show: {
            resource: ["product"],
            operation: ["createProduct", "updateProduct"],
          },
        },
        default: "",
        description: "Product image URL",
      },
      // Payment fields
      {
        displayName: "Business ID",
        name: "businessId",
        type: "string",
        displayOptions: {
          show: {
            resource: ["payment"],
            operation: ["listPayments", "getPaginatedPayments", "getPayment"],
          },
        },
        default: "",
        required: true,
        description: "Business ID to get payments for",
      },
      {
        displayName: "Payment ID",
        name: "paymentId",
        type: "string",
        displayOptions: {
          show: {
            resource: ["payment"],
            operation: ["getPayment"],
          },
        },
        default: "",
        required: true,
        description: "Payment ID to retrieve",
      },
      // Checkout fields
      {
        displayName: "Checkout ID",
        name: "checkoutId",
        type: "string",
        displayOptions: {
          show: {
            resource: ["checkout"],
            operation: ["getCheckout", "updateCheckout", "deleteCheckout"],
          },
        },
        default: "",
        required: true,
        description: "Checkout ID (uid)",
      },
      {
        displayName: "Checkout Title",
        name: "checkoutTitle",
        type: "string",
        displayOptions: {
          show: {
            resource: ["checkout"],
            operation: ["createCheckout", "updateCheckout"],
          },
        },
        default: "",
        required: true,
        description: "Checkout page title",
      },
      {
        displayName: "Checkout Slug",
        name: "checkoutSlug",
        type: "string",
        displayOptions: {
          show: {
            resource: ["checkout"],
            operation: ["createCheckout"],
          },
        },
        default: "",
        required: true,
        description: "Unique checkout identifier (slug)",
      },
      {
        displayName: "Checkout Price",
        name: "checkoutPrice",
        type: "number",
        displayOptions: {
          show: {
            resource: ["checkout"],
            operation: ["createCheckout", "updateCheckout"],
          },
        },
        default: 0,
        description: "Price in Brazilian Reais (e.g., 99.90)",
      },
      // Webhook fields
      {
        displayName: "Webhook ID",
        name: "webhookId",
        type: "string",
        displayOptions: {
          show: {
            resource: ["webhook"],
            operation: ["getWebhook", "updateWebhook", "deleteWebhook"],
          },
        },
        default: "",
        required: true,
        description: "Webhook ID",
      },
      {
        displayName: "Webhook Name",
        name: "webhookName",
        type: "string",
        displayOptions: {
          show: {
            resource: ["webhook"],
            operation: ["createWebhook", "updateWebhook"],
          },
        },
        default: "",
        required: true,
        description: "Webhook name/description",
      },
      {
        displayName: "Webhook URL",
        name: "webhookUrl",
        type: "string",
        displayOptions: {
          show: {
            resource: ["webhook"],
            operation: ["createWebhook", "updateWebhook"],
          },
        },
        default: "",
        required: true,
        description: "Webhook endpoint URL",
      },
      {
        displayName: "Events",
        name: "events",
        type: "multiOptions",
        displayOptions: {
          show: {
            resource: ["webhook"],
            operation: ["createWebhook", "updateWebhook"],
          },
        },
        options: [
          {
            name: "Payment Created",
            value: "payment.created",
          },
          {
            name: "Payment Paid",
            value: "payment.paid",
          },
          {
            name: "Payment Pending",
            value: "payment.pending",
          },
          {
            name: "Payment Refunded",
            value: "payment.refunded",
          },
          {
            name: "Payment Failed",
            value: "payment.failed",
          },
        ],
        default: ["payment.paid"],
        description: "Events to trigger this webhook",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter("resource", i) as string;
        const operation = this.getNodeParameter("operation", i) as string;

        let responseData: any;

        switch (resource) {
          case "product":
            responseData = await this.executeProductOperation(operation, i);
            break;
          case "payment":
            responseData = await this.executePaymentOperation(operation, i);
            break;
          case "checkout":
            responseData = await this.executeCheckoutOperation(operation, i);
            break;
          case "webhook":
            responseData = await this.executeWebhookOperation(operation, i);
            break;
          default:
            throw new NodeOperationError(
              this.getNode(),
              `Unknown resource: ${resource}`
            );
        }

        returnData.push({
          json: responseData,
        });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: (error as Error).message },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }

  private async executeProductOperation(
    operation: string,
    itemIndex: number
  ): Promise<any> {
    const credentials = await this.getCredentials("ggcheckoutApi");
    const baseURL = credentials?.apiUrl as string;
    const apiKey = credentials?.apiKey as string;

    switch (operation) {
      case "listProducts":
        return await this.makeRequest(
          "GET",
          `${baseURL}/api/v1/products`,
          {},
          apiKey
        );

      case "getProduct":
        const productId = this.getNodeParameter(
          "productId",
          itemIndex
        ) as string;
        return await this.makeRequest(
          "GET",
          `${baseURL}/api/v1/products/${productId}`,
          {},
          apiKey
        );

      case "createProduct":
        const createData = {
          title: this.getNodeParameter("title", itemIndex) as string,
          url: this.getNodeParameter("url", itemIndex) as string,
          description: this.getNodeParameter(
            "description",
            itemIndex
          ) as string,
          price: this.getNodeParameter("price", itemIndex) as number,
          discount: this.getNodeParameter("discount", itemIndex) as string,
          imageUrl: this.getNodeParameter("imageUrl", itemIndex) as string,
        };
        return await this.makeRequest(
          "POST",
          `${baseURL}/api/v1/products`,
          createData,
          apiKey
        );

      case "updateProduct":
        const updateProductId = this.getNodeParameter(
          "productId",
          itemIndex
        ) as string;
        const updateData = {
          title: this.getNodeParameter("title", itemIndex) as string,
          url: this.getNodeParameter("url", itemIndex) as string,
          description: this.getNodeParameter(
            "description",
            itemIndex
          ) as string,
          price: this.getNodeParameter("price", itemIndex) as number,
          discount: this.getNodeParameter("discount", itemIndex) as string,
          imageUrl: this.getNodeParameter("imageUrl", itemIndex) as string,
        };
        return await this.makeRequest(
          "PUT",
          `${baseURL}/api/v1/products/${updateProductId}`,
          updateData,
          apiKey
        );

      case "deleteProduct":
        const deleteProductId = this.getNodeParameter(
          "productId",
          itemIndex
        ) as string;
        return await this.makeRequest(
          "DELETE",
          `${baseURL}/api/v1/products/${deleteProductId}`,
          {},
          apiKey
        );

      default:
        throw new NodeOperationError(
          this.getNode(),
          `Unknown product operation: ${operation}`
        );
    }
  }

  private async executePaymentOperation(
    operation: string,
    itemIndex: number
  ): Promise<any> {
    const credentials = await this.getCredentials("ggcheckoutApi");
    const baseURL = credentials?.apiUrl as string;
    const apiKey = credentials?.apiKey as string;

    switch (operation) {
      case "listPayments":
        const listBusinessId = this.getNodeParameter(
          "businessId",
          itemIndex
        ) as string;
        return await this.makeRequest(
          "GET",
          `${baseURL}/api/v1/payments?businessId=${listBusinessId}`,
          {},
          apiKey
        );

      case "getPayment":
        const getBusinessId = this.getNodeParameter(
          "businessId",
          itemIndex
        ) as string;
        const paymentId = this.getNodeParameter(
          "paymentId",
          itemIndex
        ) as string;
        return await this.makeRequest(
          "GET",
          `${baseURL}/api/v1/payments/${paymentId}?businessId=${getBusinessId}`,
          {},
          apiKey
        );

      case "getPaginatedPayments":
        const paginatedBusinessId = this.getNodeParameter(
          "businessId",
          itemIndex
        ) as string;
        // Add pagination parameters as needed
        return await this.makeRequest(
          "GET",
          `${baseURL}/api/v1/payments/paginated?businessId=${paginatedBusinessId}`,
          {},
          apiKey
        );

      default:
        throw new NodeOperationError(
          this.getNode(),
          `Unknown payment operation: ${operation}`
        );
    }
  }

  private async executeCheckoutOperation(
    operation: string,
    itemIndex: number
  ): Promise<any> {
    const credentials = await this.getCredentials("ggcheckoutApi");
    const baseURL = credentials?.apiUrl as string;
    const apiKey = credentials?.apiKey as string;

    switch (operation) {
      case "listCheckouts":
        return await this.makeRequest(
          "GET",
          `${baseURL}/api/v1/checkouts`,
          {},
          apiKey
        );

      case "getCheckout":
        const getCheckoutId = this.getNodeParameter(
          "checkoutId",
          itemIndex
        ) as string;
        return await this.makeRequest(
          "GET",
          `${baseURL}/api/v1/checkouts/${getCheckoutId}`,
          {},
          apiKey
        );

      case "createCheckout":
        const createData = {
          title: this.getNodeParameter("checkoutTitle", itemIndex) as string,
          id: this.getNodeParameter("checkoutSlug", itemIndex) as string,
          price: this.getNodeParameter("checkoutPrice", itemIndex) as number,
          // Add other required fields as needed
        };
        return await this.makeRequest(
          "POST",
          `${baseURL}/api/v1/checkouts`,
          createData,
          apiKey
        );

      case "updateCheckout":
        const updateCheckoutId = this.getNodeParameter(
          "checkoutId",
          itemIndex
        ) as string;
        const updateData = {
          title: this.getNodeParameter("checkoutTitle", itemIndex) as string,
          price: this.getNodeParameter("checkoutPrice", itemIndex) as number,
        };
        return await this.makeRequest(
          "PUT",
          `${baseURL}/api/v1/checkouts/${updateCheckoutId}`,
          updateData,
          apiKey
        );

      case "deleteCheckout":
        const deleteCheckoutId = this.getNodeParameter(
          "checkoutId",
          itemIndex
        ) as string;
        return await this.makeRequest(
          "DELETE",
          `${baseURL}/api/v1/checkouts/${deleteCheckoutId}`,
          {},
          apiKey
        );

      default:
        throw new NodeOperationError(
          this.getNode(),
          `Unknown checkout operation: ${operation}`
        );
    }
  }

  private async executeWebhookOperation(
    operation: string,
    itemIndex: number
  ): Promise<any> {
    const credentials = await this.getCredentials("ggcheckoutApi");
    const baseURL = credentials?.apiUrl as string;
    const apiKey = credentials?.apiKey as string;

    switch (operation) {
      case "listWebhooks":
        return await this.makeRequest(
          "GET",
          `${baseURL}/api/v1/webhooks`,
          {},
          apiKey
        );

      case "getWebhook":
        const getWebhookId = this.getNodeParameter(
          "webhookId",
          itemIndex
        ) as string;
        return await this.makeRequest(
          "GET",
          `${baseURL}/api/v1/webhooks/${getWebhookId}`,
          {},
          apiKey
        );

      case "createWebhook":
        const createData = {
          name: this.getNodeParameter("webhookName", itemIndex) as string,
          url: this.getNodeParameter("webhookUrl", itemIndex) as string,
          events: this.getNodeParameter("events", itemIndex) as string[],
        };
        return await this.makeRequest(
          "POST",
          `${baseURL}/api/v1/webhooks`,
          createData,
          apiKey
        );

      case "updateWebhook":
        const updateWebhookId = this.getNodeParameter(
          "webhookId",
          itemIndex
        ) as string;
        const updateData = {
          name: this.getNodeParameter("webhookName", itemIndex) as string,
          url: this.getNodeParameter("webhookUrl", itemIndex) as string,
          events: this.getNodeParameter("events", itemIndex) as string[],
        };
        return await this.makeRequest(
          "PUT",
          `${baseURL}/api/v1/webhooks/${updateWebhookId}`,
          updateData,
          apiKey
        );

      case "deleteWebhook":
        const deleteWebhookId = this.getNodeParameter(
          "webhookId",
          itemIndex
        ) as string;
        return await this.makeRequest(
          "DELETE",
          `${baseURL}/api/v1/webhooks/${deleteWebhookId}`,
          {},
          apiKey
        );

      default:
        throw new NodeOperationError(
          this.getNode(),
          `Unknown webhook operation: ${operation}`
        );
    }
  }

  private async makeRequest(
    method: string,
    url: string,
    data: any,
    apiKey: string
  ): Promise<any> {
    const config = {
      method,
      url,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      data: method !== "GET" ? data : undefined,
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new NodeOperationError(
          this.getNode(),
          `API Error: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }
}
