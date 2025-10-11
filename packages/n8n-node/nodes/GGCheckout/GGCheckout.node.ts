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
        const credentials = await this.getCredentials("ggcheckoutApi");
        const baseURL = credentials?.apiUrl as string;
        const apiKey = credentials?.apiKey as string;

        let responseData: any;

        // Handle different resources and operations
        switch (resource) {
          case "product":
            switch (operation) {
              case "listProducts":
                const listResponse = await axios.get(
                  `${baseURL}/api/v1/products`,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = listResponse.data;
                break;
              case "getProduct":
                const productId = this.getNodeParameter(
                  "productId",
                  i
                ) as string;
                const getResponse = await axios.get(
                  `${baseURL}/api/v1/products/${productId}`,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = getResponse.data;
                break;
              case "createProduct":
                const createData = {
                  title: this.getNodeParameter("title", i) as string,
                  url: this.getNodeParameter("url", i) as string,
                  description: this.getNodeParameter(
                    "description",
                    i
                  ) as string,
                  price: this.getNodeParameter("price", i) as number,
                  discount: this.getNodeParameter("discount", i) as string,
                  imageUrl: this.getNodeParameter("imageUrl", i) as string,
                };
                const createResponse = await axios.post(
                  `${baseURL}/api/v1/products`,
                  createData,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = createResponse.data;
                break;
              case "updateProduct":
                const updateProductId = this.getNodeParameter(
                  "productId",
                  i
                ) as string;
                const updateData = {
                  title: this.getNodeParameter("title", i) as string,
                  url: this.getNodeParameter("url", i) as string,
                  description: this.getNodeParameter(
                    "description",
                    i
                  ) as string,
                  price: this.getNodeParameter("price", i) as number,
                  discount: this.getNodeParameter("discount", i) as string,
                  imageUrl: this.getNodeParameter("imageUrl", i) as string,
                };
                const updateResponse = await axios.put(
                  `${baseURL}/api/v1/products/${updateProductId}`,
                  updateData,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = updateResponse.data;
                break;
              case "deleteProduct":
                const deleteProductId = this.getNodeParameter(
                  "productId",
                  i
                ) as string;
                const deleteResponse = await axios.delete(
                  `${baseURL}/api/v1/products/${deleteProductId}`,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = deleteResponse.data;
                break;
              default:
                throw new NodeOperationError(
                  this.getNode(),
                  `Unknown product operation: ${operation}`
                );
            }
            break;
          case "payment":
            switch (operation) {
              case "listPayments":
                const listBusinessId = this.getNodeParameter(
                  "businessId",
                  i
                ) as string;
                const listPaymentsResponse = await axios.get(
                  `${baseURL}/api/v1/payments?businessId=${listBusinessId}`,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = listPaymentsResponse.data;
                break;
              case "getPayment":
                const getBusinessId = this.getNodeParameter(
                  "businessId",
                  i
                ) as string;
                const paymentId = this.getNodeParameter(
                  "paymentId",
                  i
                ) as string;
                const getPaymentResponse = await axios.get(
                  `${baseURL}/api/v1/payments/${paymentId}?businessId=${getBusinessId}`,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = getPaymentResponse.data;
                break;
              case "getPaginatedPayments":
                const paginatedBusinessId = this.getNodeParameter(
                  "businessId",
                  i
                ) as string;
                const paginatedPaymentsResponse = await axios.get(
                  `${baseURL}/api/v1/payments/paginated?businessId=${paginatedBusinessId}`,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = paginatedPaymentsResponse.data;
                break;
              default:
                throw new NodeOperationError(
                  this.getNode(),
                  `Unknown payment operation: ${operation}`
                );
            }
            break;
          case "checkout":
            switch (operation) {
              case "listCheckouts":
                const listCheckoutsResponse = await axios.get(
                  `${baseURL}/api/v1/checkouts`,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = listCheckoutsResponse.data;
                break;
              case "getCheckout":
                const getCheckoutId = this.getNodeParameter(
                  "checkoutId",
                  i
                ) as string;
                const getCheckoutResponse = await axios.get(
                  `${baseURL}/api/v1/checkouts/${getCheckoutId}`,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = getCheckoutResponse.data;
                break;
              case "createCheckout":
                const createData = {
                  title: this.getNodeParameter("checkoutTitle", i) as string,
                  id: this.getNodeParameter("checkoutSlug", i) as string,
                  price: this.getNodeParameter("checkoutPrice", i) as number,
                };
                const createCheckoutResponse = await axios.post(
                  `${baseURL}/api/v1/checkouts`,
                  createData,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = createCheckoutResponse.data;
                break;
              case "updateCheckout":
                const updateCheckoutId = this.getNodeParameter(
                  "checkoutId",
                  i
                ) as string;
                const updateData = {
                  title: this.getNodeParameter("checkoutTitle", i) as string,
                  price: this.getNodeParameter("checkoutPrice", i) as number,
                };
                const updateCheckoutResponse = await axios.put(
                  `${baseURL}/api/v1/checkouts/${updateCheckoutId}`,
                  updateData,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = updateCheckoutResponse.data;
                break;
              case "deleteCheckout":
                const deleteCheckoutId = this.getNodeParameter(
                  "checkoutId",
                  i
                ) as string;
                const deleteCheckoutResponse = await axios.delete(
                  `${baseURL}/api/v1/checkouts/${deleteCheckoutId}`,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = deleteCheckoutResponse.data;
                break;
              default:
                throw new NodeOperationError(
                  this.getNode(),
                  `Unknown checkout operation: ${operation}`
                );
            }
            break;
          case "webhook":
            switch (operation) {
              case "listWebhooks":
                const listWebhooksResponse = await axios.get(
                  `${baseURL}/api/v1/webhooks`,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = listWebhooksResponse.data;
                break;
              case "getWebhook":
                const getWebhookId = this.getNodeParameter(
                  "webhookId",
                  i
                ) as string;
                const getWebhookResponse = await axios.get(
                  `${baseURL}/api/v1/webhooks/${getWebhookId}`,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = getWebhookResponse.data;
                break;
              case "createWebhook":
                const createData = {
                  name: this.getNodeParameter("webhookName", i) as string,
                  url: this.getNodeParameter("webhookUrl", i) as string,
                  events: this.getNodeParameter("events", i) as string[],
                };
                const createWebhookResponse = await axios.post(
                  `${baseURL}/api/v1/webhooks`,
                  createData,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = createWebhookResponse.data;
                break;
              case "updateWebhook":
                const updateWebhookId = this.getNodeParameter(
                  "webhookId",
                  i
                ) as string;
                const updateData = {
                  name: this.getNodeParameter("webhookName", i) as string,
                  url: this.getNodeParameter("webhookUrl", i) as string,
                  events: this.getNodeParameter("events", i) as string[],
                };
                const updateWebhookResponse = await axios.put(
                  `${baseURL}/api/v1/webhooks/${updateWebhookId}`,
                  updateData,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = updateWebhookResponse.data;
                break;
              case "deleteWebhook":
                const deleteWebhookId = this.getNodeParameter(
                  "webhookId",
                  i
                ) as string;
                const deleteWebhookResponse = await axios.delete(
                  `${baseURL}/api/v1/webhooks/${deleteWebhookId}`,
                  {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }
                );
                responseData = deleteWebhookResponse.data;
                break;
              default:
                throw new NodeOperationError(
                  this.getNode(),
                  `Unknown webhook operation: ${operation}`
                );
            }
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
}
