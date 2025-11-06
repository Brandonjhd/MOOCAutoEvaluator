// ==UserScript==
// @name         中国大学MOOC自动互评助手
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  自动完成中国大学MOOC的作业互评，支持批量评价
// @author       UXU倒計時
// @match        https://www.icourse163.org/spoc/learn/*
// @match        https://www.icourse163.org/learn/*
// @icon         https://www.icourse163.org/favicon.ico
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let comments = [];
    let currentIndex = 0;
    let isRunning = false;
    let uiInitialized = false;
    let shouldStop = false;

    function initUI() {
        if (uiInitialized) {
            const existingBall = document.getElementById('mooc-auto-eval-ball');
            if (existingBall) {
                existingBall.style.display = 'flex';
                return;
            }
        }

        const floatingBall = document.createElement('div');
        floatingBall.id = 'mooc-auto-eval-ball';
        floatingBall.innerHTML = '✓';
        floatingBall.style.cssText = `
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            transition: all 0.3s ease;
        `;

        floatingBall.addEventListener('mouseenter', () => {
            floatingBall.style.transform = 'translateY(-50%) scale(1.1)';
        });

        floatingBall.addEventListener('mouseleave', () => {
            floatingBall.style.transform = 'translateY(-50%) scale(1)';
        });

        const panel = document.createElement('div');
        panel.id = 'mooc-auto-eval-panel';
        panel.style.cssText = `
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            width: 380px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            padding: 20px;
            z-index: 10001;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-height: 90vh;
            overflow-y: auto;
        `;

        panel.innerHTML = `
            <div style="margin-bottom: 15px;">
                <h3 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">🤖 中国大学MOOC自动互评助手</h3>
                <p style="margin: 0; font-size: 12px; color: #666;">作者: UXU倒計時</p>
            </div>

            <div style="margin-bottom: 15px; padding: 12px; background: #f0f7ff; border-radius: 8px; border: 1px solid #d0e8ff;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="font-size: 14px; font-weight: bold; color: #333;">🎯 互评AI提示词生成器</span>
                </div>
                <div id="promptInfo" style="font-size: 12px; color: #666; margin-bottom: 8px; line-height: 1.5;">
                    检测中...
                </div>
                <div style="display: flex; justify-content: center;">
                    <button id="copyPromptBtn" style="padding: 10px 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; transition: all 0.3s;">
                        📋 复制互评AI提示词
                    </button>
                </div>
            </div>

            <textarea id="commentsInput" placeholder="请输入点评内容，每行一条评价"
                style="width: 100%; height: 150px; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 13px; resize: vertical; box-sizing: border-box; font-family: inherit; margin-bottom: 15px;"></textarea>

            <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 8px; font-size: 12px;">
                <div style="margin-bottom: 5px;">
                    <span style="color: #666;">剩余评价:</span>
                    <span id="commentCount" style="color: #667eea; font-weight: bold;">0</span>
                    <span style="color: #666;">条</span>
                </div>
                <div>
                    <span style="color: #666;">已完成:</span>
                    <span id="currentProgress" style="color: #764ba2; font-weight: bold;">0</span>
                    <span style="color: #666;">个作业</span>
                </div>
            </div>

            <div style="display: flex; gap: 10px;">
                <button id="startBtn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; transition: all 0.3s;">
                    开始评价
                </button>
                <button id="stopBtn" style="flex: 1; padding: 12px; background: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; display: none; transition: all 0.3s;">
                    停止
                </button>
                <button id="closeBtn" style="padding: 12px 15px; background: #9e9e9e; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
                    ✕
                </button>
            </div>

            <div id="statusMsg" style="margin-top: 12px; padding: 10px; background: #e3f2fd; border-radius: 8px; font-size: 12px; color: #1976d2; display: none;"></div>
        `;

        document.body.appendChild(floatingBall);
        document.body.appendChild(panel);

        floatingBall.addEventListener('click', () => {
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                floatingBall.style.display = 'none';
                updatePromptInfo();
            }
        });

        document.getElementById('closeBtn').addEventListener('click', () => {
            panel.style.display = 'none';
            floatingBall.style.display = 'flex';
        });

        document.getElementById('commentsInput').addEventListener('input', (e) => {
            updateCommentCount();
        });

        document.getElementById('copyPromptBtn').addEventListener('click', () => {
            copyAIPrompt();
        });

        document.getElementById('startBtn').addEventListener('click', async () => {
            const input = document.getElementById('commentsInput').value.trim();

            if (!input) {
                showStatus('请先输入点评内容！可以使用互评AI提示词快速生成', 'error');
                return;
            }

            comments = input.split('\n').filter(line => line.trim());

            if (comments.length === 0) {
                showStatus('请至少输入一条点评！', 'error');
                return;
            }

            if (!window.location.href.includes('learn/hw')) {
                showStatus('请在互评页面使用此功能！', 'error');
                return;
            }

            isRunning = true;
            shouldStop = false;
            currentIndex = 0;
            updateProgress();
            document.getElementById('startBtn').style.display = 'none';
            document.getElementById('stopBtn').style.display = 'block';

            showStatus('开始自动评价...', 'info');
            await autoEvaluate();
        });

        document.getElementById('stopBtn').addEventListener('click', () => {
            shouldStop = true;
            showStatus('正在停止...', 'info');
        });

        uiInitialized = true;
    }

    function updateCommentCount() {
        const text = document.getElementById('commentsInput').value.trim();
        const lines = text ? text.split('\n').filter(line => line.trim()) : [];
        document.getElementById('commentCount').textContent = lines.length;
    }

    function updateProgress() {
        document.getElementById('currentProgress').textContent = currentIndex;
        updateCommentCount();
    }

    function updatePromptInfo() {
        const courseElement = document.querySelector('a[href*="/spoc/course/"] h4.courseTxt, a[href*="/learn/"] h4.courseTxt');
        const hwElement = document.querySelector('.j-hwname');

        const courseName = courseElement ? courseElement.textContent.trim() : '未检测到课程名';
        const hwName = hwElement ? hwElement.textContent.trim() : '未检测到作业名';

        const promptInfo = document.getElementById('promptInfo');
        if (courseName !== '未检测到课程名' && hwName !== '未检测到作业名') {
            promptInfo.innerHTML = `
                <div style="margin-bottom: 4px;"><strong>课程:</strong> ${courseName}</div>
                <div><strong>作业:</strong> ${hwName}</div>
            `;
        } else {
            promptInfo.textContent = '未检测到课程或作业信息';
        }
    }

    function copyAIPrompt() {
        const courseElement = document.querySelector('a[href*="/spoc/course/"] h4.courseTxt, a[href*="/learn/"] h4.courseTxt');
        const hwElement = document.querySelector('.j-hwname');

        const courseName = courseElement ? courseElement.textContent.trim() : '';
        const hwName = hwElement ? hwElement.textContent.trim() : '';

        if (!courseName || !hwName) {
            showStatus('未能提取课程或作业信息，请确认在互评页面', 'error');
            return;
        }

        const prompt = `请根据《${courseName}》《${hwName}》生成30个学生互评通用评价，每个评价100-120字的，换行输出，不可空行，无序号，一行一个。`;

        navigator.clipboard.writeText(prompt).then(() => {
            showStatus('✅ AI提示词已复制到剪贴板！可以直接粘贴到AI对话框', 'success');
            const btn = document.getElementById('copyPromptBtn');
            btn.textContent = '✅ 已复制！';
            setTimeout(() => {
                btn.textContent = '📋 复制AI提示词';
            }, 2000);
        }).catch(() => {
            showStatus('复制失败，请手动复制：' + prompt, 'error');
        });
    }

    function showStatus(message, type = 'info') {
        const statusMsg = document.getElementById('statusMsg');
        if (!statusMsg) return;

        statusMsg.style.display = 'block';
        statusMsg.textContent = message;

        if (type === 'error') {
            statusMsg.style.background = '#ffebee';
            statusMsg.style.color = '#c62828';
        } else if (type === 'success') {
            statusMsg.style.background = '#e8f5e9';
            statusMsg.style.color = '#2e7d32';
        } else {
            statusMsg.style.background = '#e3f2fd';
            statusMsg.style.color = '#1976d2';
        }
    }

    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (shouldStop) {
                reject(new Error('用户已停止'));
                return;
            }

            const startTime = Date.now();

            const checkElement = () => {
                if (shouldStop) {
                    reject(new Error('用户已停止'));
                    return;
                }

                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`元素 ${selector} 未找到`));
                } else {
                    setTimeout(checkElement, 100);
                }
            };

            checkElement();
        });
    }

    function sleep(ms) {
        return new Promise(resolve => {
            const startTime = Date.now();
            const checkStop = () => {
                if (shouldStop) {
                    resolve();
                } else if (Date.now() - startTime >= ms) {
                    resolve();
                } else {
                    setTimeout(checkStop, 100);
                }
            };
            checkStop();
        });
    }

    async function autoEvaluate() {
        try {
            if (shouldStop) {
                throw new Error('用户已停止');
            }

            if (comments.length === 0) {
                showStatus('⚠️ 评价已用完！请添加更多评价内容后继续', 'error');
                stopEvaluation();
                return;
            }

            showStatus(`正在评价第 ${currentIndex + 1} 份作业...`, 'info');
            await sleep(1000);

            if (shouldStop) throw new Error('用户已停止');

            window.scrollTo(0, document.body.scrollHeight);
            await sleep(800);

            if (shouldStop) throw new Error('用户已停止');

            const radio100 = await waitForElement('input[type="radio"][value="100"]');
            if (!radio100) {
                throw new Error('未找到100分选项');
            }

            radio100.click();
            showStatus('✓ 已选择100分', 'success');
            await sleep(800);

            if (shouldStop) throw new Error('用户已停止');

            showStatus('正在填写点评...', 'info');
            const commentBox = await waitForElement('textarea');
            if (!commentBox) {
                throw new Error('未找到点评输入框');
            }

            const comment = comments[0];
            commentBox.value = comment;
            commentBox.dispatchEvent(new Event('input', { bubbles: true }));
            commentBox.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(1000);

            if (shouldStop) throw new Error('用户已停止');

            showStatus('✓ 点评已填写，准备提交...', 'success');

            const submitBtn = document.querySelector('a.j-submitbtn') ||
                             document.querySelector('a[class*="submitbtn"]') ||
                             Array.from(document.querySelectorAll('a.u-btn')).find(btn =>
                                 btn.textContent.includes('提交')
                             );

            if (!submitBtn) {
                const allButtons = Array.from(document.querySelectorAll('button'));
                const buttonSubmit = allButtons.find(btn =>
                    btn.textContent.includes('提交') && !btn.textContent.includes('返回')
                );

                if (buttonSubmit) {
                    buttonSubmit.click();
                } else {
                    throw new Error('未找到提交按钮');
                }
            } else {
                submitBtn.click();
            }

            showStatus('✓ 已提交，等待页面响应...', 'success');
            await sleep(3000);

            if (shouldStop) throw new Error('用户已停止');

            comments.shift();
            document.getElementById('commentsInput').value = comments.join('\n');
            updateCommentCount();

            showStatus('正在查找继续按钮...', 'info');
            await sleep(1500);

            if (shouldStop) throw new Error('用户已停止');

            const allLinks = Array.from(document.querySelectorAll('a'));
            const continueBtnLink = allLinks.find(link =>
                link.textContent.includes('继续评估') ||
                link.textContent.includes('下一份') ||
                link.textContent.includes('继续')
            );

            if (!continueBtnLink) {
                showStatus('🎉 所有作业已评价完成！', 'success');
                stopEvaluation();
                return;
            }

            continueBtnLink.click();
            showStatus('正在加载下一份作业...', 'info');
            await sleep(3000);

            if (shouldStop) throw new Error('用户已停止');

            currentIndex++;
            updateProgress();

            if (isRunning && !shouldStop) {
                await autoEvaluate();
            }

        } catch (error) {
            if (error.message === '用户已停止') {
                showStatus('✋ 已停止评价', 'info');
            } else {
                showStatus(`错误: ${error.message}`, 'error');
                console.error('自动评价出错:', error);
            }
            stopEvaluation();
        }
    }

    function stopEvaluation() {
        isRunning = false;
        shouldStop = false;
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        if (startBtn) startBtn.style.display = 'block';
        if (stopBtn) stopBtn.style.display = 'none';
        if (startBtn) startBtn.textContent = '开始评价';
    }

    function checkAndInitUI() {
        const currentUrl = window.location.href;
        if (currentUrl.includes('learn/hw') || currentUrl.includes('spoc/learn')) {
            setTimeout(initUI, 500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndInitUI);
    } else {
        checkAndInitUI();
    }

    window.addEventListener('hashchange', () => {
        console.log('URL变化:', window.location.href);
        checkAndInitUI();
    });

    const observer = new MutationObserver(() => {
        if (window.location.href.includes('learn/hw')) {
            const ball = document.getElementById('mooc-auto-eval-ball');
            if (!ball) {
                initUI();
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
