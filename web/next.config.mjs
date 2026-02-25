import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const nextConfig = {
  outputFileTracingRoot: __dirname,
  webpack: (config) => {
    config.resolve.fallback = { fs: false, encoding: false, buffer: false }

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules\/web-worker\/cjs\/node\.js/,
        message: /Critical dependency: the request of a dependency is an expression/
      }
    ]

    return config
  }
}

export default nextConfig
