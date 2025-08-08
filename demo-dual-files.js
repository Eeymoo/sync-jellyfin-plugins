#!/usr/bin/env node
/**
 * 演示双文件翻译功能
 * 显示原始版本和翻译版本的差异
 */

const fs = require('fs');
const path = require('path');

function demonstrateDualFileStructure() {
    console.log('🔍 双文件翻译结构演示\n');
    
    // 示例原始数据
    const originalData = {
        name: "Example Authentication Plugin",
        description: "Provides secure LDAP authentication for Jellyfin server users",
        author: "Community Developer",
        versions: [
            {
                version: "1.0.0",
                changelog: "Initial release with basic LDAP support",
                timestamp: "2024-01-15T10:00:00Z",
                sourceUrl: "https://example.com/plugin-1.0.0.zip"
            },
            {
                version: "1.1.0", 
                changelog: "Added SSL support and improved error handling",
                timestamp: "2024-02-20T14:30:00Z",
                sourceUrl: "https://example.com/plugin-1.1.0.zip"
            }
        ]
    };
    
    // 示例翻译数据
    const translatedData = {
        name: "Example Authentication Plugin",
        description: "为Jellyfin服务器用户提供安全的LDAP身份验证\n\n原文: Provides secure LDAP authentication for Jellyfin server users",
        author: "Community Developer",
        versions: [
            {
                version: "1.0.0",
                changelog: "初始版本，提供基本的LDAP支持\n\n原文: Initial release with basic LDAP support",
                timestamp: "2024-01-15T10:00:00Z",
                sourceUrl: "https://example.com/plugin-1.0.0.zip"
            },
            {
                version: "1.1.0",
                changelog: "添加了SSL支持并改进了错误处理\n\n原文: Added SSL support and improved error handling",
                timestamp: "2024-02-20T14:30:00Z",
                sourceUrl: "https://example.com/plugin-1.1.0.zip"
            }
        ]
    };
    
    console.log('📄 1. 原始版本 (manifest-original.json):');
    console.log('━'.repeat(60));
    console.log(JSON.stringify(originalData, null, 2));
    
    console.log('\n📄 2. 翻译版本 (manifest.json):');
    console.log('━'.repeat(60));
    console.log(JSON.stringify(translatedData, null, 2));
    
    console.log('\n📊 3. 关键差异:');
    console.log('━'.repeat(60));
    console.log('✅ 翻译字段: description, changelog');
    console.log('⚪ 保持不变: name, author, version, timestamp, sourceUrl');
    console.log('📦 双文件存储: 原始版本 + 翻译版本');
    console.log('🔗 默认访问: manifest.json (翻译版本)');
    console.log('🔗 原文访问: manifest-original.json (原始版本)');
    
    console.log('\n🌐 4. 上传地址示例:');
    console.log('━'.repeat(60));
    console.log('原始版本: https://bucket.oss.aliyuncs.com/plugins/ExamplePlugin/manifest-original.json');
    console.log('翻译版本: https://bucket.oss.aliyuncs.com/plugins/ExamplePlugin/manifest.json');
    
    console.log('\n💡 5. 使用场景:');
    console.log('━'.repeat(60));
    console.log('• 中国用户: 访问翻译版本 (manifest.json)');
    console.log('• 国际用户: 访问原始版本 (manifest-original.json)');
    console.log('• 开发者: 可以同时查看翻译效果和原文');
    console.log('• API调用: 根据需求选择不同版本');
    
    console.log('\n🎉 演示完成！');
}

// 运行演示
demonstrateDualFileStructure();
