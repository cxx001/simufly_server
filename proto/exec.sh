#!/bin/sh
protoc --experimental_allow_proto3_optional --js_out=import_style=commonjs,binary:. .\*.proto
