// paper.animate.js v0.1.6

paper.Item.prototype.animate = function (duration, updater, chain) {
    if (arguments.length === 2) {
        if (updater.IsUpdater !== true) {
            chain = updater;
            updater = undefined;
        }
    }
    var proxy = new PaperAnimate.AnimationProxy(duration, chain || false, this);
    if (updater !== null) updater.animations.push(proxy);
    return proxy;
};

var PaperAnimate = {};

PaperAnimate.Updater = (function () {

    function Updater() {
        this.IsUpdater = true;
        this.animations = [];
    }

    Updater.prototype.update = function (e) {
        var toRemove = [];
            for (var i = 0; i < this.animations.length; i++) {
                if (this.animations[i].update(e) === false) {
                    toRemove.push(this.animations[i]);
                }
            }
        for (var j = 0; j < toRemove.length; j++) {
          this.animations.splice(this.animations.indexOf(toRemove[j]), 1);
        }
    };

    return Updater;
})();

// Animation Proxy

PaperAnimate.AnimationProxy = (function () {
    var retVal;

    function AnimationProxy(_duration, chain, item) {
        this.item = item;
        this.modifiers = [];
        retVal = (chain === false) ? item : this;
        this.duration = _duration || 1000;
    }

    AnimationProxy.prototype.update = function (e) {
        if (this.duration <= 0) {
            this.modifiers.length = 0;
            delete this.targetShape;
            return false;
        }
        for (var i = 0; i < this.modifiers.length; i++) {
            this.modifiers[i].update(e);
        }
        var deltaOverrun = e.delta - this.duration;
        if (deltaOverrun > 0) e.delta -= deltaOverrun;
        if (this.targetShape !== undefined && this.item.segments !== undefined) {
            for (var j = 0; j < this.item.segments.length; j++) {
                this.item.segments[j] = PaperAnimate.utils.interpolateSegment(0, this.duration, this.item.segments[j], this.targetShape.segments[j], e.delta);
            }
        }
        this.duration -= e.delta;
    };

    AnimationProxy.prototype.removeModifier = function (modifier) {
        var index = this.modifiers.indexOf(modifier);
        if (index >= 0) {
            this.modifiers.splice(index, 1);
        }
    };

    AnimationProxy.prototype.initTargetShape = function () {
        this.targetShape = this.item.clone();
        this.targetShape.fullySelected = false;
        this.targetShape.visible = false;
    };

    AnimationProxy.prototype.scale = function () {
        if (this.targetShape === undefined) { this.initTargetShape(); }
        this.targetShape.scale.apply(this.targetShape, arguments);
        return retVal;
    };

    AnimationProxy.prototype.translate = function (point) {
        this.modifiers.push(new PaperAnimate.modifiers.TranslateModifier(point, this));
        return retVal;
    };

    AnimationProxy.prototype.rotate = function (angle, center) {
        this.modifiers.push(new PaperAnimate.modifiers.RotateModifier(angle, center, this));
        return retVal;
    };

    AnimationProxy.prototype.shear = function (hor, ver, center) {
        if (this.targetShape === undefined) { this.initTargetShape(); }
        this.targetShape.shear(hor, ver, center);
        return retVal;
    };

    AnimationProxy.prototype.transform = function (matrix, flags) {
        if (this.targetShape === undefined) { this.initTargetShape(); }
        this.targetShape.transform(matrix, flags);
        return retVal;
    };

    AnimationProxy.prototype.fitBounds = function (rectangle, fill) {
        if (this.targetShape === undefined) { this.initTargetShape(); }
        this.targetShape.fitBounds(rectangle, fill);
        return retVal;
    };

    AnimationProxy.prototype.replaceShape = function (newShape) {
        if (newShape.segments.length !== this.item.segments.length) return;
        this.targetShape = newShape.clone();
		this.targetShape.visible = false;
        newShape.remove();
        return retVal;
    };

    return AnimationProxy;
})();

// Modifiers

PaperAnimate.modifiers = {};

PaperAnimate.modifiers.TranslateModifier = (function () {

    function TranslateModifier(_point, _proxy) {
        this.point = _point;
        this.proxy = _proxy;
    }

    TranslateModifier.prototype.update = function (e) {
        var updatePoint = PaperAnimate.utils.multiplyPoint(this.point, e.delta / this.proxy.duration);
        this.proxy.item.translate(updatePoint);
        if (this.proxy.targetShape !== undefined) {
            this.proxy.targetShape.translate(updatePoint);
        }
        this.point.x = this.point.x - updatePoint.x;
        this.point.y = this.point.y - updatePoint.y;
    };

    return TranslateModifier;

})();

PaperAnimate.modifiers.RotateModifier = (function () {
    function RotateModifier(_angle, _center, _proxy) {
        this.angle = _angle / _proxy.duration;
        this.center = _center;
        this.proxy = _proxy;
    }

    RotateModifier.prototype.update = function (e) {
        this.proxy.item.rotate(this.angle * e.delta, this.center);
        if (this.proxy.targetShape !== undefined) {
            this.proxy.targetShape.rotate(this.angle * e.delta, this.center);
        }
    };

    return RotateModifier;
})();

// Utils

PaperAnimate.utils = (function () {
    return {
        multiplyPoint: function (a, b) {
            return this.newPointOp(function (x, y) { return x * y; }, a, b);
        },
        dividePoint: function (a, b) {
            return this.newPointOp(function (x, y) { return x / y; }, a, b);
        },
        subtractPoint: function (a, b) {
            return this.newPointOp(function (x, y) { return x - y; }, a, b);
        },
        addPoint: function (a, b) {
            return this.newPointOp(function (x, y) { return x + y; }, a, b);
        },
        newPointOp: function (fn, a, b) {
            return new paper.Point(
                fn(this.get(a, "x"), this.get(b, "x")),
                fn(this.get(a, "y"), this.get(b, "y"))
            );
        },
        multiplySegment: function (a, b) {
            var self = this;
            return this.newSegmentOp(function (x, y) { return self.multiplyPoint(x, y); }, a, b);
        },
        divideSegment: function (a, b) {
            var self = this;
            return this.newSegmentOp(function (x, y) { return self.dividePoint(x, y); }, a, b);
        },
        subtractSegment: function (a, b) {
            var self = this;
            return this.newSegmentOp(function (x, y) { return self.subtractPoint(x, y); }, a, b);
        },
        addSegment: function (a, b) {
            var self = this;
            return this.newSegmentOp(function (x, y) { return self.addPoint(x, y); }, a, b);
        },
        newSegmentOp: function (fn, a, b) {
            return new paper.Segment(
                fn(this.get(a, "point"), this.get(b, "point")),
                fn(this.get(a, "handleIn"), this.get(b, "handleIn")),
                fn(this.get(a, "handleOut"), this.get(b, "handleOut"))
            );
        },
        interpolateSegment: function (x1, x2, y1, y2, x) {
            // y = ((x-x1)(y2-y1)/(x2-x1))+y1 (x: seconds, y: segments)
            return this.addSegment(
            this.divideSegment(
                    this.multiplySegment(x - x1, this.subtractSegment(y2, y1)),
                    x2 - x1),
                y1);
        },
        get: function (val, prop) { return val[prop] !== undefined ? val[prop] : val; }
    }
})();
