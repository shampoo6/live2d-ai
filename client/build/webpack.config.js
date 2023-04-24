const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const {VueLoaderPlugin} = require('vue-loader');

module.exports = (env, params) => {
    return {
        mode: 'development',
        target: ['web', 'es5'],
        entry: './src/main.ts',
        output: {
            path: path.resolve(__dirname, '../dist'),
            filename: 'bundle.js',
            // publicPath: '/dist/'
        },
        resolve: {
            extensions: ['.ts', '.js'],
            alias: {
                'vue': 'vue/dist/vue.esm-bundler.js',
                '@': path.resolve(__dirname, '../src'),
                '@framework': path.resolve(__dirname, '../src/assets/Framework/src')
            },
            fallback: {'path': require.resolve('path-browserify')}
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    loader: 'ts-loader',
                    options: {
                        appendTsSuffixTo: [/\.vue$/]
                    }
                },
                {
                    test: /\.vue$/,
                    loader: 'vue-loader'
                },
                {
                    test: /\.css$/,
                    use: [
                        'vue-style-loader',
                        {
                            loader: 'css-loader',
                            options: {
                                modules: false,
                            }
                        }
                    ]
                }
            ]
        },
        plugins: [
            new HtmlWebpackPlugin({
                favicon: path.resolve(__dirname, '../public/favicon.ico'),
                template: path.resolve(__dirname, '../public/index.html'),
                templateParameters: {
                    title: 'live2d'
                }
            }),
            new CleanWebpackPlugin(),
            new VueLoaderPlugin()
        ],
        devServer: {
            static: [
                {
                    directory: path.resolve(__dirname, '../dist'),
                    serveIndex: true,
                    watch: true,
                },
                {
                    directory: path.resolve(__dirname, '../public'),
                    serveIndex: true,
                },
                {
                    directory: path.resolve(__dirname, '../live2dAssets'),
                },
            ],
            hot: true,
            port: 5000,
            host: '0.0.0.0',
            compress: true,
            devMiddleware: {
                writeToDisk: true,
            },
        },
        devtool: 'inline-source-map'
    };
};