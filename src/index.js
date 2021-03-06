'use strict';

import {Bezier} from 'amfe-cubicbezier';

const FPS = 60;
var INTERVAL = 1000 / FPS;

function setTimeoutFrame(cb) {
    return setTimeout(cb, INTERVAL);
}

function clearTimeoutFrame(tick) {
    clearTimeout(tick);
}

var requestAnimationFrame =
    window.requestAnimationFrame ||
    window.msRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    setTimeoutFrame;


var cancelAnimationFrame =
    window.cancelAnimationFrame ||
    window.msCancelAnimationFrame ||
    window.webkitCancelAnimationFrame ||
    window.mozCancelAnimationFrame ||
    clearTimeoutFrame;

if (requestAnimationFrame === setTimeoutFrame || cancelAnimationFrame === clearTimeoutFrame) {
    requestAnimationFrame = setTimeoutFrame;
    cancelAnimationFrame = clearTimeoutFrame;
}

function PromiseDefer() {
    var deferred = {};
    var promise = new Promise((resolve, reject) => {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    deferred.promise = promise;
    return deferred;
}

function PromiseMixin(promise, context) {
    var _promise = promise;
    ['then', 'catch'].forEach((method) => {
        context[method] = function() {
            return promise[method].apply(_promise, arguments);
        };
    });
    return context;
}


function getFrameQueue(duration, frames) {
    if (typeof frames === 'function') {
        frames = {
            '0': frames
        };
    }

    var frameCount = duration / INTERVAL;
    var framePercent = 1 / frameCount;
    var frameQueue = [];
    var frameKeys = Object.keys(frames).map(i => parseInt(i));

    for (var i = 0; i < frameCount; i++) {
        var key = frameKeys[0];
        var percent = framePercent * i;
        if (key !== null && key <= percent * 100) {
            var frame = frames[key.toString()];
            if (!(frame instanceof Frame)) {
                frame = new Frame(frame);
            }
            frameQueue.push(frame);
            frameKeys.shift();
        } else if (frameQueue.length) {
            frameQueue.push(frameQueue[frameQueue.length - 1].clone());
        }
    }

    return frameQueue;
}

function getBezier(timingFunction) {
    var bezier;
    if (typeof timingFunction === 'string' || timingFunction instanceof Array) {
        if (Bezier) {
            //console.error('require amfe-cubicbezier');
        } else {
            if (typeof timingFunction === 'string') {
                if (Bezier[timingFunction]) {
                    bezier = Bezier[timingFunction];
                }
            } else if (timingFunction instanceof Array && timingFunction.length === 4){
                bezier = Bezier.apply(Bezier, timingFunction);
            }
        }
    } else if (typeof timingFunction === 'function') {
        bezier = timingFunction;
    }

    return bezier;
}

/**
 * 构造一个帧对象
 * @class lib.animation~Frame
 * @param {Function} fun 当前帧执行的函数
 */
function Frame(fun) {
    var defer;
    var tick;
    var isCancel =false;

    /**
     * 执行帧
     * @method request
     * @instance
     * @memberOf lib.animation~Frame
     * @return {lib.animation~Frame} 当前实例
     */
    this.request = function() {
        isCancel = false;
        var args = arguments;

        defer = PromiseDefer();
        PromiseMixin(defer.promise, this);

        tick = requestAnimationFrame(() => {
            if (isCancel) {
                return;
            }
            defer && defer.resolve(fun.apply(window, args));
        });

        return this;
    };

    /**
     * 取消执行
     * @method cancel
     * @instance
     * @memberOf lib.animation~Frame
     * @return {lib.animation~Frame} 当前实例
     */
    this.cancel = function() {
        if (tick) {
            isCancel = true;
            cancelAnimationFrame(tick);
            defer && defer.reject('CANCEL');
        }

        return this;
    };

    /**
     * 复制一个帧实例
     * @method clone
     * @instance
     * @memberOf lib.animation~Frame
     * @return {lib.animation~Frame} 新实例
     */
    this.clone = function() {
        return new Frame(fun);
    };
}


export default class animation {

    /**
     * 初始化一个动画实例
     * @method animation
     * @memberOf lib
     * @param {Number} duration       动画时间，单位毫秒
     * @param {String|Array|Function} timingFunction 时间函数，支持标准的时间函数名、贝塞尔曲线数组（需要lib.cubicbezier库支持）以及自定义函数
     * @param {Function} frames       每一帧执行的函数
     * @property {Function} frame 初始化一个帧实例
     * @property {Function} requestFrame 立即请求帧
     * @return {lib.animation~Animation}            Animation实例
     */
    constructor(duration, timingFunction, frames) {
        var defer;
        var frameQueue = getFrameQueue(duration, frames);
        var framePercent = 1 / (duration / INTERVAL);
        var frameIndex = 0;
        var bezier = getBezier(timingFunction);

        if (!bezier) {
            throw new Error('unexcept timing function');
        }

        var isPlaying = false;
        /**
         * 播放动画
         * @method play
         * @return {lib.animation~Animation} this 当前实例
         * @instance
         * @memberOf lib.animation~Animation
         */
        this.play = function() {
            if (isPlaying) {
                return;
            }
            isPlaying = true;

            if (!defer) {
                defer = PromiseDefer();
                PromiseMixin(defer.promise, this);
            }

            function request() {
                var percent = framePercent * (frameIndex + 1).toFixed(10);
                var currentFrame = frameQueue[frameIndex];

                currentFrame
                    .request(percent.toFixed(10), timingFunction(percent).toFixed(10))
                    .then(() => {
                        if (!isPlaying){
                            return;
                        }

                        if (frameIndex === frameQueue.length - 1) {
                            isPlaying = false;
                            defer && defer.resolve('FINISH');
                            defer = null;
                        } else {
                            frameIndex++;
                            request();
                        }
                    }, () => {
                        // CANCEL
                    });
            }

            request();
            return this;
        };

        /**
         * 暂停动画
         * @method stop
         * @return {lib.animation~Animation} this 当前实例
         * @instance
         * @memberOf lib.animation~Animation
         */
        this.stop = function() {
            if (!isPlaying) {
                return;
            }
            isPlaying = false;

            if (frameQueue[frameIndex]) {
                frameQueue[frameIndex].cancel();
            }
            return this;
        };
    }
    /**
     * 构造一个帧对象
     * @class lib.animation~Frame
     * @param {Function} fun 当前帧执行的函数
     */
    frame (fun){
        return new Frame(fun);
    }

    requestFrame (fun) {
        var frame = new Frame(fun);
        return frame.request();
    }
}