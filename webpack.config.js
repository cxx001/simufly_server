"use strict"
const path = require("path");
const webpack = require("webpack");
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const HappyPack = require("happypack");
let externals = _externals();

module.exports = {
    mode: "production",
    entry: "./app.js",
    target: "node",
    output: {
        path: path.resolve(__dirname, "build"),
        filename: "[name].js",
    },
    resolve: {
        extensions: [".js", ".json"]
    },
    externals: externals,
    context: __dirname,
    node: {
        // console: true,
        // global: true,
        // process: true,
        // Buffer: true,
        __filename: false,
        __dirname: false,
        // setImmediate: true
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: ["happypack/loader?id=babel"],
                include: [
                    path.resolve(__dirname, "app"),
                    path.resolve(__dirname, "proto"),
                    path.resolve(__dirname, "tools"),
                ],
                exclude: [
                    path.resolve(__dirname, "node_modules")
                ]
                // options: {
                //     presets: ["es2015", "stage-0"],
                //     exclude: /node_modules/
                // }
            }
        ]
    },
    plugins: [
        // new webpack.optimize.UglifyJsPlugin()
        new HappyPack({
            id: "babel",
            loaders: ["babel-loader?cacheDirectory"]
        })
    ],
    optimization: { //与entry同级
        splitChunks: {
            chunks: 'async',
            minChunks: 2,
        },
        minimizer: [
            new UglifyJsPlugin({
                uglifyOptions: {
                    compress: false,
                    mangle: true,
                    output: {
                        comments: false,
                    },
                },
                sourceMap: false,
            })
        ]   
    },
}

function _externals() {
    let mainfest = require("./package.json");
    let dependencies = mainfest.dependencies;
    let externals = {};
    for (let p in dependencies) {
        externals[p] = "commonjs " + p
    }

    return externals
}