#!/usr/bin/env node

/**
 * Node.js 基础功能测试
 */

console.log('🧪 Node.js 基础功能测试');
console.log('=' .repeat(50));

// 简单的断言函数
function assertEqual(actual, expected, message) {
    if (actual === expected) {
        console.log(`✅ ${message}`);
        return true;
    } else {
        console.log(`❌ ${message}`);
        console.log(`   期望: ${expected}`);
        console.log(`   实际: ${actual}`);
        return false;
    }
}

function assertTruthy(value, message) {
    if (value) {
        console.log(`✅ ${message}`);
        return true;
    } else {
        console.log(`❌ ${message}`);
        console.log(`   期望: truthy`);
        console.log(`   实际: ${value}`);
        return false;
    }
}

function runTests() {
    const results = [];

    console.log('\n📋 运行测试用例:');
    
    // Node.js 环境测试
    results.push(assertEqual(typeof process, 'object', 'Node.js 环境应该正常工作'));
    results.push(assertEqual(typeof process.version, 'string', 'process.version 应该是字符串'));
    results.push(assertTruthy(process.version.startsWith('v'), 'Node.js 版本应该以 v 开头'));

    // Date 对象测试
    const now = new Date();
    results.push(assertTruthy(now instanceof Date, 'Date 对象应该正常工作'));
    results.push(assertEqual(typeof now.toISOString(), 'string', 'Date.toISOString() 应该返回字符串'));
    results.push(assertTruthy(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(now.toISOString()), 'ISO 字符串格式应该正确'));

    // console 对象测试
    results.push(assertEqual(typeof console.log, 'function', 'console.log 应该可用'));
    results.push(assertEqual(typeof console.error, 'function', 'console.error 应该可用'));
    results.push(assertEqual(typeof console.warn, 'function', 'console.warn 应该可用'));

    // 基本 JavaScript 功能测试
    const testArray = [1, 2, 3, 4, 5];
    results.push(assertEqual(testArray.length, 5, '数组长度应该正确'));
    results.push(assertEqual(JSON.stringify(testArray.filter(x => x > 3)), JSON.stringify([4, 5]), '数组 filter 方法应该正常'));
    results.push(assertEqual(JSON.stringify(testArray.map(x => x * 2)), JSON.stringify([2, 4, 6, 8, 10]), '数组 map 方法应该正常'));

    // 对象操作测试
    const testObject = { a: 1, b: 2 };
    results.push(assertEqual(JSON.stringify(Object.keys(testObject)), JSON.stringify(['a', 'b']), 'Object.keys 应该正常'));
    results.push(assertEqual(JSON.stringify(Object.values(testObject)), JSON.stringify([1, 2]), 'Object.values 应该正常'));

    // JSON 操作测试
    const jsonString = JSON.stringify(testObject);
    results.push(assertEqual(typeof jsonString, 'string', 'JSON.stringify 应该返回字符串'));
    results.push(assertEqual(JSON.stringify(JSON.parse(jsonString)), JSON.stringify(testObject), 'JSON 序列化和反序列化应该一致'));

    // 模块系统测试
    results.push(assertEqual(typeof require, 'function', 'require 函数应该可用'));
    results.push(assertEqual(typeof module, 'object', 'module 对象应该可用'));
    results.push(assertEqual(typeof exports, 'object', 'exports 对象应该可用'));

    // 全局对象测试
    results.push(assertEqual(typeof global, 'object', 'global 对象应该可用'));
    results.push(assertEqual(typeof Buffer, 'function', 'Buffer 构造函数应该可用'));
    results.push(assertEqual(typeof setTimeout, 'function', 'setTimeout 应该可用'));
    results.push(assertEqual(typeof setInterval, 'function', 'setInterval 应该可用'));

    // 文件系统模块测试
    const fs = require('fs');
    results.push(assertEqual(typeof fs.readFileSync, 'function', 'fs.readFileSync 应该可用'));
    results.push(assertEqual(typeof fs.writeFileSync, 'function', 'fs.writeFileSync 应该可用'));
    results.push(assertEqual(typeof fs.existsSync, 'function', 'fs.existsSync 应该可用'));

    // 路径模块测试
    const path = require('path');
    results.push(assertEqual(typeof path.join, 'function', 'path.join 应该可用'));
    results.push(assertEqual(typeof path.resolve, 'function', 'path.resolve 应该可用'));
    results.push(assertEqual(typeof path.dirname, 'function', 'path.dirname 应该可用'));
    results.push(assertEqual(typeof path.basename, 'function', 'path.basename 应该可用'));

    // 统计结果
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果统计:');
    console.log(`   总测试数: ${total}`);
    console.log(`   通过数: ${passed}`);
    console.log(`   失败数: ${total - passed}`);
    console.log(`   成功率: ${Math.round((passed / total) * 100)}%`);
    console.log('='.repeat(50));
    
    if (passed === total) {
        console.log('\n🎉 所有测试通过！');
    } else {
        console.log('\n❌ 部分测试失败');
    }

    // 输出基本信息
    console.log('\n📋 系统信息:');
    console.log(`   Node.js 版本: ${process.version}`);
    console.log(`   平台: ${process.platform}`);
    console.log(`   架构: ${process.arch}`);
    console.log(`   当前时间: ${new Date().toISOString()}`);
    
    return passed === total;
}

if (require.main === module) {
    const success = runTests();
    process.exit(success ? 0 : 1);
}
