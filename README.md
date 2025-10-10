# GG Checkout MCP Monorepo

This monorepo contains both the MCP server and n8n node for GG Checkout integration.

## 📦 Packages

### 🧠 MCP Server (`packages/mcp/`)

Model Context Protocol server for managing GG Checkout products via AI agents.

- **Package**: `ggcheckout-mcp`
- **Usage**: Claude Desktop, other MCP clients
- **Installation**: `npm install -g ggcheckout-mcp`

### 🔧 n8n Node (`packages/n8n-node/`)

n8n community node for GG Checkout integration.

- **Package**: `n8n-nodes-ggcheckout`
- **Usage**: n8n workflows
- **Installation**: Follow n8n community nodes guide

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
```

### Build All Packages

```bash
npm run build
```

### Publish MCP

```bash
npm run publish:mcp
```

### Publish n8n Node

```bash
npm run publish:n8n
```

## 📁 Structure

```
ggcheckout-mcp/
├── packages/
│   ├── mcp/                 # MCP Server
│   │   ├── src/            # Source code
│   │   ├── dist/           # Built files
│   │   └── package.json    # MCP package
│   └── n8n-node/           # n8n Node
│       ├── credentials/    # n8n credentials
│       ├── nodes/          # n8n nodes
│       └── package.json    # n8n package
├── package.json            # Monorepo config
└── README.md              # This file
```

## 🔄 Reuse Strategy

The n8n node **reuses** the MCP server by:

- Installing `ggcheckout-mcp` as a dependency
- Executing MCP commands via child processes
- No code duplication - single source of truth

## 📚 Documentation

- **MCP Documentation**: See `packages/mcp/README.md`
- **n8n Documentation**: See `packages/n8n-node/README.md`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test both packages
5. Submit a pull request

## 📄 License

MIT © GG Checkout Team
