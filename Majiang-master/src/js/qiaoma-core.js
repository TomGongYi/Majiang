"use strict";

const Shoupai = require('../../node_modules/@kobalab/majiang-core/lib/shoupai');
const OriginalShan = require('../../node_modules/@kobalab/majiang-core/lib/shan');

const FLOWER_TILES = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8',
    'z5', 'z5', 'z5', 'z5',
    'z6', 'z6', 'z6', 'z6',
    'z7', 'z7', 'z7', 'z7',
];
const FLOWERS = new Set(FLOWER_TILES);
const DEAD_WALL_SIZE = 0; // Qiaoma draws the whole wall; no dead wall.

const original_valid_pai = Shoupai.valid_pai;
const original_valid_mianzi = Shoupai.valid_mianzi;

function tile_base(p) {
    return typeof p == 'string' ? p.slice(0, 2) : '';
}

function is_huapai(p) {
    return FLOWERS.has(tile_base(p));
}

function is_playable(p) {
    return !! original_valid_pai.call(Shoupai, p) && ! is_huapai(p);
}

function hongpai_from_rule(rule) {
    for (let value of Object.values(rule || {})) {
        if (! value || Array.isArray(value) || typeof value != 'object') continue;
        if (['m','p','s'].every(s => typeof value[s] == 'number')) {
            return {
                m: Math.max(0, Math.min(4, value.m | 0)),
                p: Math.max(0, Math.min(4, value.p | 0)),
                s: Math.max(0, Math.min(4, value.s | 0)),
            };
        }
    }
    return { m: 0, p: 0, s: 0 };
}

function shuffle(pai) {
    const rv = [];
    while (pai.length) {
        rv.push(pai.splice(Math.floor(Math.random() * pai.length), 1)[0]);
    }
    return rv;
}

Shoupai.valid_pai = function(p) {
    if (is_huapai(p)) return;
    return original_valid_pai.call(this, p);
};

Shoupai.valid_mianzi = function(m) {
    if (typeof m == 'string' && m.match(/^z.*[567]/)) return;
    return original_valid_mianzi.call(this, m);
};

class QiaomaShan {

    static zhenbaopai(p) {
        if (is_huapai(p)) throw new Error(p);
        return OriginalShan.zhenbaopai(p);
    }

    constructor(rule) {

        this._rule = rule || {};
        const hongpai = hongpai_from_rule(rule);

        const pai = [];
        for (let s of ['m','p','s']) {
            for (let n = 1; n <= 9; n++) {
                for (let i = 0; i < 4; i++) {
                    pai.push(n == 5 && i < hongpai[s] ? s + 0 : s + n);
                }
            }
        }
        for (let n = 1; n <= 4; n++) {
            for (let i = 0; i < 4; i++) pai.push('z' + n);
        }
        pai.push(...FLOWER_TILES);

        this._pai = shuffle(pai);
        this._huapai = [[], [], [], []];
        this._unknown_huapai = [];
        this._baopai = [this._find_baopai(4)];
        this._fubaopai = null;
        this._weikaigang = false;
        this._closed = false;
    }

    _find_baopai(start) {
        for (let i = start; i < this._pai.length; i++) {
            if (is_playable(this._pai[i])) return this._pai[i];
        }
        return 'z1';
    }

    _record_huapai(owner, p) {
        if (owner != null && this._huapai[owner]) this._huapai[owner].push(p);
        else                                      this._unknown_huapai.push(p);
    }

    record_huapai(owner, p) {
        if (! is_huapai(p)) return this;
        this._record_huapai(owner, p);
        return this;
    }

    _draw_one_from_tail(owner) {
        while (this._pai.length > DEAD_WALL_SIZE) {
            const p = this._pai.pop();
            return p;
        }
        return null;
    }

    _draw_playable_from_tail(owner) {
        while (this._pai.length > DEAD_WALL_SIZE) {
            const p = this._draw_one_from_tail(owner);
            if (is_huapai(p)) {
                this._record_huapai(owner, p);
                continue;
            }
            if (! p || ! is_huapai(p)) return p;
        }
        return null;
    }

    _draw_one_from_dead_wall(owner) {
        while (this._pai.length > DEAD_WALL_SIZE) {
            if (this._baopai.length == 5) throw new Error(this);
            const p = this._pai.shift();
            return p;
        }
        return null;
    }

    qipai(owner) {
        return this._draw_playable_from_tail(owner);
    }

    zimo(owner) {
        if (this._closed) throw new Error(this);
        return this._draw_one_from_tail(owner);
    }

    buhua(owner) {
        if (this._closed) throw new Error(this);
        return this._draw_one_from_tail(owner);
    }

    gangzimo(owner) {
        if (this._closed) throw new Error(this);
        return this._draw_one_from_dead_wall(owner);
    }

    kaigang() {
        if (this._closed) throw new Error(this);
        this._baopai.push(this._find_baopai(4));
        this._weikaigang = false;
        return this;
    }

    close() {
        this._closed = true;
        return this;
    }

    get paishu() {
        return this._pai.length;
    }

    get baopai() {
        return this._baopai.filter(x => x);
    }

    get fubaopai() {
        return null;
    }

    get huapai() {
        return this._huapai.map(x => x.concat());
    }

    get unknown_huapai() {
        return this._unknown_huapai.concat();
    }
}

require.cache[require.resolve('../../node_modules/@kobalab/majiang-core/lib/shan')]
    .exports = QiaomaShan;

const Xiangting = require('../../node_modules/@kobalab/majiang-core/lib/xiangting');
const original_xiangting_yiban = Xiangting.xiangting_yiban;

function xiangting(shoupai) {
    return original_xiangting_yiban(shoupai);
}

function tingpai(shoupai, f_xiangting = xiangting) {

    if (shoupai._zimo) return null;

    const pai = [];
    const n_xiangting = f_xiangting(shoupai);
    for (let s of ['m','p','s']) {
        const bingpai = shoupai._bingpai[s];
        for (let n = 1; n <= 9; n++) {
            if (bingpai[n] >= 4) continue;
            bingpai[n]++;
            if (f_xiangting(shoupai) < n_xiangting) pai.push(s + n);
            bingpai[n]--;
        }
    }
    for (let n = 1; n <= 4; n++) {
        const bingpai = shoupai._bingpai.z;
        if (bingpai[n] >= 4) continue;
        bingpai[n]++;
        if (f_xiangting(shoupai) < n_xiangting) pai.push('z' + n);
        bingpai[n]--;
    }
    return pai;
}

Xiangting.xiangting = xiangting;
Xiangting.tingpai = tingpai;
Xiangting.xiangting_qidui = () => Infinity;
Xiangting.xiangting_guoshi = () => Infinity;

const Hule = require('../../node_modules/@kobalab/majiang-core/lib/hule');

function mianzi(s, bingpai, n = 1) {

    if (n > 9) return [[]];
    if (bingpai[n] == 0) return mianzi(s, bingpai, n + 1);

    let shunzi = [];
    if (s != 'z' && n <= 7
        && bingpai[n] > 0 && bingpai[n + 1] > 0 && bingpai[n + 2] > 0)
    {
        bingpai[n]--; bingpai[n + 1]--; bingpai[n + 2]--;
        shunzi = mianzi(s, bingpai, n);
        bingpai[n]++; bingpai[n + 1]++; bingpai[n + 2]++;
        for (let m of shunzi) m.unshift(s + n + (n + 1) + (n + 2));
    }

    let kezi = [];
    if (bingpai[n] == 3) {
        bingpai[n] -= 3;
        kezi = mianzi(s, bingpai, n + 1);
        bingpai[n] += 3;
        for (let m of kezi) m.unshift(s + n + n + n);
    }

    return shunzi.concat(kezi);
}

function mianzi_all(shoupai) {

    let shupai_all = [[]];
    for (let s of ['m','p','s']) {
        const new_mianzi = [];
        for (let mm of shupai_all) {
            for (let nn of mianzi(s, shoupai._bingpai[s])) {
                new_mianzi.push(mm.concat(nn));
            }
        }
        shupai_all = new_mianzi;
    }

    const zipai = [];
    for (let n = 1; n <= 4; n++) {
        if (shoupai._bingpai.z[n] == 0) continue;
        if (shoupai._bingpai.z[n] != 3) return [];
        zipai.push('z' + n + n + n);
    }

    const fulou = shoupai._fulou.map(m => m.replace(/0/g, '5'));
    return shupai_all.map(shupai => shupai.concat(zipai).concat(fulou));
}

function add_hulepai(mianzi, p) {

    const [s, n, d] = p;
    const regexp = new RegExp(`^(${s}.*${n})`);
    const replacer = `$1${d}!`;
    const new_mianzi = [];

    for (let i = 0; i < mianzi.length; i++) {
        if (mianzi[i].match(/[\+\=\-]|\d{4}/)) continue;
        if (i > 0 && mianzi[i] == mianzi[i - 1]) continue;
        const m = mianzi[i].replace(regexp, replacer);
        if (m == mianzi[i]) continue;
        const tmp_mianzi = mianzi.concat();
        tmp_mianzi[i] = m;
        new_mianzi.push(tmp_mianzi);
    }

    return new_mianzi;
}

function hule_mianzi_yiban(shoupai, hulepai) {

    let rv = [];
    for (let s of ['m','p','s','z']) {
        const bingpai = shoupai._bingpai[s];
        const max = s == 'z' ? 4 : 9;
        for (let n = 1; n <= max; n++) {
            if (bingpai[n] < 2) continue;
            bingpai[n] -= 2;
            const jiangpai = s + n + n;
            for (let mm of mianzi_all(shoupai)) {
                mm.unshift(jiangpai);
                if (mm.length != 5) continue;
                rv = rv.concat(add_hulepai(mm, hulepai));
            }
            bingpai[n] += 2;
        }
    }
    return rv;
}

function hule_mianzi(shoupai, rongpai) {

    const new_shoupai = shoupai.clone();
    if (rongpai) new_shoupai.zimo(rongpai);

    if (! new_shoupai._zimo || new_shoupai._zimo.length > 2) return [];
    const hulepai = (rongpai || new_shoupai._zimo + '_').replace(/0/, '5');

    return hule_mianzi_yiban(new_shoupai, hulepai);
}

function hule(shoupai, rongpai, param = {}) {

    if (! hule_mianzi(shoupai, rongpai).length) return;

    return {
        hupai:  [{ name: 'Hule', fanshu: 0 }],
        fu:     0,
        fanshu: 0,
        defen:  0,
        fenpei: [0, 0, 0, 0],
    };
}

Hule.hule = hule;
Hule.hule_mianzi = hule_mianzi;

const Board = require('../../node_modules/@kobalab/majiang-core/lib/board');

const board_qipai = Board.prototype.qipai;
Board.prototype.qipai = function(qipai) {
    board_qipai.call(this, qipai);
    if (qipai.paishu != null) this.shan.paishu = qipai.paishu;
    if (qipai.huapai) this.huapai = qipai.huapai;
    this.pending_huapai = [null, null, null, null];
    for (let shoupai of this.shoupai) {
        if (shoupai) shoupai._qiaoma_pending_huapai = null;
    }
    this.qiao = qipai.qiao ? qipai.qiao.concat() : [false, false, false, false];
};

const board_zimo = Board.prototype.zimo;
Board.prototype.zimo = function(zimo) {
    if (zimo.buhua || is_huapai(zimo.p)) {
        this.lizhi();
        this.lunban = zimo.l;
        if (zimo.paishu != null) this.shan.paishu = zimo.paishu;
        this.pending_huapai = this.pending_huapai || [null, null, null, null];
        this.pending_huapai[zimo.l] = zimo.p || '_';
        if (this.shoupai[zimo.l]) {
            this.shoupai[zimo.l]._qiaoma_pending_huapai = zimo.p || '_';
        }
        if (zimo.huapai) {
            this.huapai = this.huapai || [[], [], [], []];
            this.huapai[zimo.l] = zimo.huapai.concat();
        }
        return;
    }
    if (this.pending_huapai) this.pending_huapai[zimo.l] = null;
    if (this.shoupai[zimo.l]) this.shoupai[zimo.l]._qiaoma_pending_huapai = null;
    board_zimo.call(this, zimo);
    if (zimo.paishu != null) this.shan.paishu = zimo.paishu;
    if (zimo.huapai) {
        this.huapai = this.huapai || [[], [], [], []];
        this.huapai[zimo.l] = zimo.huapai.concat();
    }
};

const board_dapai = Board.prototype.dapai;
Board.prototype.dapai = function(dapai) {
    if (! this.qiao) this.qiao = [false, false, false, false];
    if (dapai.qiao) this.qiao[dapai.l] = true;
    board_dapai.call(this, dapai);
};

const Game = require('../../node_modules/@kobalab/majiang-core/lib/game');

function qiao_dapai(rule, shoupai) {

    if (! shoupai._zimo) return [];

    const dapai = [];
    for (let p of Game.get_dapai(rule, shoupai) || []) {
        const new_shoupai = shoupai.clone().dapai(p);
        if (xiangting(new_shoupai) != 0) continue;
        const tingpai = Majiang.Util.tingpai(new_shoupai) || [];
        if (tingpai.length) dapai.push(p);
    }
    return dapai;
}

function moqie_dapai(shoupai) {
    if (! shoupai || ! shoupai._zimo || shoupai._zimo.length > 2) return [];
    return [shoupai._zimo + '_'];
}

function huapai_for(model, l) {
    if (model.shan && Array.isArray(model.shan.huapai)) {
        return model.shan.huapai[l] || [];
    }
    if (Array.isArray(model.huapai)) return model.huapai[l] || [];
    return [];
}

function has_huapai(model, l) {
    return huapai_for(model, l).length > 0;
}

function is_chi_peng_mianzi(m) {
    if (! m || ! m.match(/[\+\=\-]/)) return false;
    const n_pai = (m.match(/\d/g) || []).length;
    if (n_pai == 3) return true;
    return n_pai == 4 && !! m.match(/[\+\=\-]\d$/);
}

function has_chi_peng(shoupai) {
    return !! (shoupai._fulou || []).find(is_chi_peng_mianzi);
}

function allow_rong_by_huapai_or_no_chi_peng(model, l, shoupai) {
    return has_huapai(model, l) || ! has_chi_peng(shoupai);
}

function pingju_no_pai(game) {
    game._buhua = false;
    game._buhua_type = null;
    return game.delay(() => game.pingju('', ['', '', '', '']), 0);
}

function send_zimo(game, type, zimo) {

    if (! zimo) return pingju_no_pai(game);

    const model = game._model;
    const l = model.lunban;
    const buhua = is_huapai(zimo);

    game._pending_huapai = game._pending_huapai || [null, null, null, null];
    if (! buhua) model.shoupai[l].zimo(zimo);
    game._pending_huapai[l] = buhua ? zimo : null;
    game._buhua = buhua;
    game._buhua_type = buhua ? type : null;

    const paipu = {};
    paipu[type] = {
        l:      l,
        p:      zimo,
        paishu: model.shan.paishu,
        huapai: model.shan.huapai[l],
    };
    if (buhua) paipu[type].buhua = true;

    game.add_paipu(paipu);

    if (type == 'gangzimo' && game._gang) game.kaigang();

    const msg = [];
    for (let i = 0; i < 4; i++) {
        msg[i] = JSON.parse(JSON.stringify(paipu));
        if (i != l) msg[i][type].p = '';
    }
    game.call_players(type, msg);

    if (game._view) game._view.update(paipu);
}

Game.prototype.qipai = function(shan) {

    const model = this._model;

    model.shan = shan || new QiaomaShan(this._rule);
    for (let l = 0; l < 4; l++) {
        const qipai = [];
        for (let i = 0; i < 13; i++) qipai.push(model.shan.qipai(l));
        model.shoupai[l] = new Shoupai(qipai);
        model.he[l] = new (require('../../node_modules/@kobalab/majiang-core/lib/he'))();
        model.player_id[l] = (model.qijia + model.jushu + l) % 4;
    }
    model.lunban = -1;

    this._diyizimo = true;
    this._fengpai = false;

    this._dapai = null;
    this._gang = null;

    this._lizhi = [0, 0, 0, 0];
    this._yifa = [0, 0, 0, 0];
    this._n_gang = [0, 0, 0, 0];
    this._neng_rong = [1, 1, 1, 1];
    this._qiao = [false, false, false, false];
    this._buhua = false;
    this._buhua_type = null;
    this._pending_huapai = [null, null, null, null];
    model.qiao = this._qiao.concat();

    this._hule = [];
    this._hule_option = null;
    this._no_game = false;
    this._lianzhuang = false;
    this._changbang = model.changbang;
    this._fenpei = null;

    this._paipu.defen = model.defen.concat();
    this._paipu.log.push([]);
    const paipu = {
        qipai: {
            zhuangfeng: model.zhuangfeng,
            jushu:      model.jushu,
            changbang:  model.changbang,
            lizhibang:  model.lizhibang,
            defen:      model.player_id.map(id => model.defen[id]),
            baopai:     model.shan.baopai[0],
            shoupai:    model.shoupai.map(shoupai => shoupai.toString()),
            paishu:     model.shan.paishu,
            huapai:     model.shan.huapai,
            qiao:       model.qiao,
        }
    };
    this.add_paipu(paipu);

    const msg = [];
    for (let l = 0; l < 4; l++) {
        msg[l] = JSON.parse(JSON.stringify(paipu));
        for (let i = 0; i < 4; i++) {
            if (i != l) msg[l].qipai.shoupai[i] = '';
        }
    }
    this.call_players('qipai', msg, 0);

    if (this._view) this._view.redraw();
};

Game.prototype.zimo = function() {

    const model = this._model;

    model.lunban = (model.lunban + 1) % 4;

    const zimo = model.shan.zimo(model.lunban);
    return send_zimo(this, 'zimo', zimo);
};

Game.prototype.gangzimo = function() {

    const model = this._model;

    this._diyizimo = false;
    this._yifa = [0, 0, 0, 0];

    const zimo = model.shan.gangzimo(model.lunban);
    return send_zimo(this, 'gangzimo', zimo);
};

Game.prototype.dapai = function(dapai) {

    const model = this._model;

    this._yifa[model.lunban] = 0;

    if (! model.shoupai[model.lunban].lizhi)
                                    this._neng_rong[model.lunban] = true;

    model.shoupai[model.lunban].dapai(dapai);
    model.he[model.lunban].dapai(dapai);

    this._fengpai = false;

    if (Majiang.Util.xiangting(model.shoupai[model.lunban]) == 0
        && Majiang.Util.tingpai(model.shoupai[model.lunban])
                        .find(p => model.he[model.lunban].find(p)))
    {
        this._neng_rong[model.lunban] = false;
    }

    this._dapai = dapai;

    const paipu = { dapai: { l: model.lunban, p: dapai } };
    if (this._declaring_qiao) paipu.dapai.qiao = true;
    this.add_paipu(paipu);

    if (this._gang) this.kaigang();

    const msg = [];
    for (let l = 0; l < 4; l++) {
        msg[l] = JSON.parse(JSON.stringify(paipu));
    }
    this.call_players('dapai', msg);

    if (this._view) this._view.update(paipu);
};

Game.prototype.allow_qiao = function() {
    const model = this._model;
    if (this._qiao && this._qiao[model.lunban]) return false;
    const dapai = qiao_dapai(this._rule, model.shoupai[model.lunban]);
    return dapai.length ? dapai : false;
};

Game.allow_qiao = function(rule, shoupai) {
    return qiao_dapai(rule, shoupai);
};

Game.allow_lizhi = function() {
    return false;
};

const game_get_dapai = Game.prototype.get_dapai;
Game.prototype.get_dapai = function() {
    const model = this._model;
    if (this._qiao && this._qiao[model.lunban]) {
        return moqie_dapai(model.shoupai[model.lunban]);
    }
    return game_get_dapai.apply(this, arguments);
};

const game_allow_hule = Game.prototype.allow_hule;
Game.prototype.allow_hule = function(l) {
    const menfeng = l == null ? this._model.lunban : l;
    if (! this._qiao || ! this._qiao[menfeng]) return false;
    if (l != null
        && ! allow_rong_by_huapai_or_no_chi_peng(
                this._model, menfeng, this._model.shoupai[menfeng]))
    {
        return false;
    }
    return game_allow_hule.apply(this, arguments);
};

Game.prototype.qiao = function(dapai) {

    const model = this._model;
    const l = model.lunban;

    this._qiao[l] = true;
    model.qiao = this._qiao.concat();
    for (let player of this._players) {
        if (player) {
            if (player._qiao) player._qiao[l] = true;
            if (player._model) player._model.qiao = model.qiao.concat();
        }
    }

    this._declaring_qiao = true;
    try {
        this.dapai(dapai);
    }
    finally {
        this._declaring_qiao = false;
    }
};

Game.prototype.buhua = function() {
    const model = this._model;
    const l = model.lunban;
    const type = this._buhua_type || 'zimo';
    const huapai = this._pending_huapai && this._pending_huapai[l];
    if (huapai) model.shan.record_huapai(l, huapai);
    if (this._pending_huapai) this._pending_huapai[l] = null;
    const zimo = model.shan.buhua(l);
    return send_zimo(this, type, zimo);
};

const reply_zimo = Game.prototype.reply_zimo;
Game.prototype.reply_zimo = function() {

    const model = this._model;
    const reply = this.get_reply(model.lunban);

    if (this._buhua) {
        return this.delay(() => this.buhua(), 0);
    }

    if (reply.qiao && this.allow_qiao()) {
        let dapai = reply.dapai && reply.dapai.replace(/\*$/, '');
        const qiao_dapai = this.allow_qiao();
        if (! qiao_dapai.find(p => p == dapai)) dapai = qiao_dapai[0];
        return this.delay(() => this.qiao(dapai), 0);
    }

    return reply_zimo.apply(this, arguments);
};

const reply_fulou = Game.prototype.reply_fulou;
Game.prototype.reply_fulou = function() {

    const model = this._model;

    if (! this._gang) {
        const reply = this.get_reply(model.lunban);
        if (reply.qiao && this.allow_qiao()) {
            let dapai = reply.dapai;
            const qiao_dapai = this.allow_qiao();
            if (! qiao_dapai.find(p => p == dapai)) dapai = qiao_dapai[0];
            return this.delay(() => this.qiao(dapai), 0);
        }
    }

    return reply_fulou.apply(this, arguments);
};

const reply_dapai = Game.prototype.reply_dapai;
Game.prototype.reply_dapai = function() {
    const neng_rong = this._neng_rong.concat();
    const qiao = this._qiao ? this._qiao.concat() : [false, false, false, false];
    const rv = reply_dapai.apply(this, arguments);
    for (let l = 0; l < 4; l++) {
        if (! qiao[l] && neng_rong[l]) this._neng_rong[l] = true;
    }
    return rv;
};

const reply_gang = Game.prototype.reply_gang;
Game.prototype.reply_gang = function() {
    const neng_rong = this._neng_rong.concat();
    const qiao = this._qiao ? this._qiao.concat() : [false, false, false, false];
    const rv = reply_gang.apply(this, arguments);
    for (let l = 0; l < 4; l++) {
        if (! qiao[l] && neng_rong[l]) this._neng_rong[l] = true;
    }
    return rv;
};

const game_get_chi_mianzi = Game.prototype.get_chi_mianzi;
Game.prototype.get_chi_mianzi = function(l) {
    if (this._qiao && this._qiao[l]) return [];
    return game_get_chi_mianzi.apply(this, arguments);
};

const game_get_peng_mianzi = Game.prototype.get_peng_mianzi;
Game.prototype.get_peng_mianzi = function(l) {
    if (this._qiao && this._qiao[l]) return [];
    return game_get_peng_mianzi.apply(this, arguments);
};

const Player = require('../../node_modules/@kobalab/majiang-core/lib/player');

const player_qipai = Player.prototype.qipai;
Player.prototype.qipai = function(qipai) {
    player_qipai.call(this, qipai);
    this._qiao = qipai.qiao ? qipai.qiao.concat() : [false, false, false, false];
};

Player.prototype.allow_qiao = function(shoupai) {
    if (this._qiao && this._qiao[this._menfeng]) return false;
    const dapai = Game.allow_qiao(this._rule, shoupai);
    return dapai.length ? dapai : false;
};

Player.prototype.allow_lizhi = function() {
    return false;
};

const player_get_dapai = Player.prototype.get_dapai;
Player.prototype.get_dapai = function(shoupai) {
    if (this._qiao && this._qiao[this._menfeng]) {
        return moqie_dapai(shoupai);
    }
    return player_get_dapai.apply(this, arguments);
};

const player_allow_hule = Player.prototype.allow_hule;
Player.prototype.allow_hule = function(shoupai, p) {
    if (! this._qiao || ! this._qiao[this._menfeng]) return false;
    if (p && ! allow_rong_by_huapai_or_no_chi_peng(
                this._model, this._menfeng, shoupai))
    {
        return false;
    }
    return player_allow_hule.apply(this, arguments);
};

const player_get_chi_mianzi = Player.prototype.get_chi_mianzi;
Player.prototype.get_chi_mianzi = function() {
    if (this._qiao && this._qiao[this._menfeng]) return [];
    return player_get_chi_mianzi.apply(this, arguments);
};

const player_get_peng_mianzi = Player.prototype.get_peng_mianzi;
Player.prototype.get_peng_mianzi = function() {
    if (this._qiao && this._qiao[this._menfeng]) return [];
    return player_get_peng_mianzi.apply(this, arguments);
};

const Majiang = require('../../node_modules/@kobalab/majiang-core');
Majiang.Shan = QiaomaShan;
Majiang.Util = Object.assign(Xiangting, Hule);
Majiang.Qiaoma = {
    FLOWER_TILES: FLOWER_TILES.concat(),
    is_huapai: is_huapai,
};

module.exports = Majiang;
