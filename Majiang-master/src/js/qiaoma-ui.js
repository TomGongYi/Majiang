"use strict";

const class_name = ['main', 'xiajia', 'duimian', 'shangjia'];
const flower_name = {
    h1: '春', h2: '夏', h3: '秋', h4: '冬',
    h5: '梅', h6: '兰', h7: '竹', h8: '菊',
};

function huapai_all(model) {
    if (model.shan && Array.isArray(model.shan.huapai)) return model.shan.huapai;
    if (Array.isArray(model.huapai)) return model.huapai;
    return [[], [], [], []];
}

function qiao_all(model) {
    return Array.isArray(model.qiao) ? model.qiao : [false, false, false, false];
}

function make_huapai(pai, p) {
    if (p && p.match(/^h[1-8]$/)) {
        return $('<span>')
                .addClass('pai flower-number')
                .attr('data-pai', p)
                .text(flower_name[p]);
    }
    return pai(p);
}

function pick_qiao_dapai(player, qiao_dapai) {

    let dapai = player.select_dapai && player.select_dapai();
    if (dapai) dapai = dapai.replace(/\*$/, '');
    if (! qiao_dapai.find(p => p == dapai)) dapai = qiao_dapai[0];

    return dapai;
}

module.exports = function(Majiang) {

    const Board = Majiang.UI.Board;
    if (! Board || Board.prototype._qiaoma_huapai_patched) return;
    Board.prototype._qiaoma_huapai_patched = true;

    Board.prototype._ensure_huapai = function() {
        for (let c of class_name) {
            if ($(`> .huapai.${c}`, this._root).length) continue;
            this._root.append($('<div>').addClass(`huapai ${c}`)
                                        .attr('aria-label', '花牌'));
        }
    };

    Board.prototype._ensure_qiao_marker = function() {
        for (let c of class_name) {
            if ($(`> .qiao-marker.${c}`, this._root).length) continue;
            this._root.append($('<div>').addClass(`qiao-marker ${c}`)
                                        .attr('aria-label', '敲')
                                        .text('敲'));
        }
    };

    Board.prototype._redraw_huapai = function() {

        this._ensure_huapai();

        const huapai = huapai_all(this._model);
        for (let l = 0; l < 4; l++) {
            const id = this._model.player_id[l];
            const c = class_name[(id + 4 - this.viewpoint) % 4];
            const node = $(`> .huapai.${c}`, this._root).empty();
            for (let p of huapai[l] || []) {
                node.append(make_huapai(this._pai, p));
            }
        }
        return this;
    };

    Board.prototype._redraw_qiao = function() {

        this._ensure_qiao_marker();

        const qiao = qiao_all(this._model);
        for (let l = 0; l < 4; l++) {
            const id = this._model.player_id[l];
            const c = class_name[(id + 4 - this.viewpoint) % 4];
            $(`> .player.${c}`, this._root).toggleClass('qiaoed', !! qiao[l]);
            $(`> .qiao-marker.${c}`, this._root).toggleClass('active', !! qiao[l]);
        }
        return this;
    };

    const redraw = Board.prototype.redraw;
    Board.prototype.redraw = function() {
        const rv = redraw.apply(this, arguments);
        this._redraw_huapai();
        this._redraw_qiao();
        return rv;
    };

    const update = Board.prototype.update;
    Board.prototype.update = function() {
        const rv = update.apply(this, arguments);
        this._redraw_huapai();
        this._redraw_qiao();
        return rv;
    };

    const UIShoupai = Majiang.UI.Shoupai;
    const shoupai_redraw = UIShoupai.prototype.redraw;
    UIShoupai.prototype.redraw = function() {
        const rv = shoupai_redraw.apply(this, arguments);
        const p = this._shoupai._qiaoma_pending_huapai;
        if (p) {
            this._node.bingpai.append(
                $('<span class="zimo qiaoma-pending-huapai">')
                    .append(this._open && p != '_' ? make_huapai(this._pai, p)
                                                   : this._pai('_')));
        }
        return rv;
    };

    const UIPlayer = Majiang.UI.Player;

    UIPlayer.prototype.select_qiao_dapai = function(qiao_dapai) {

        this._default_reply = { qiao: '-', dapai: qiao_dapai[0] };

        for (let p of qiao_dapai) {
            const pai_node = $(p.slice(-1) == '_'
                            ? `.zimo .pai[data-pai="${p.slice(0,2)}"]`
                            : `> .pai[data-pai="${p}"]`,
                        this._node.dapai);
            pai_node.addClass('blink')
                .attr('tabindex', 0).attr('role', 'button')
                .on('click.dapai', (ev) => {
                    $(ev.target).addClass('dapai');
                    this.callback({ qiao: '-', dapai: p });
                });
        }

        Majiang.UI.Util.setSelector($('.pai[tabindex]', this._node.dapai),
                    'dapai', { focus: -1 });
    };

    UIPlayer.prototype.action_zimo = function(zimo, gangzimo) {
        if (zimo.l != this._menfeng) return this.callback();

        if (zimo.buhua || Majiang.Qiaoma.is_huapai(zimo.p)) {
            this._default_reply = { buhua: '-' };
            this.set_button('buhua', () => this.callback({ buhua: '-' }));
            this.show_button(() => this.callback({ buhua: '-' }));
            return;
        }

        if (this.allow_hule(this.shoupai, null, gangzimo)) {
            this.set_button('zimo', () => this.callback({ hule: '-' }));
        }

        if (this.allow_pingju(this.shoupai)) {
            this.set_button('pingju', () => this.callback({ daopai: '-' }));
        }

        const gang_mianzi = this.get_gang_mianzi(this.shoupai);
        if (gang_mianzi.length == 1) {
            this.set_button('gang', () => this.callback({ gang: gang_mianzi[0] }));
        }
        else if (gang_mianzi.length > 1) {
            this.set_button('gang', () => this.select_mianzi(gang_mianzi));
        }

        const qiao_dapai = this.allow_qiao(this.shoupai) || [];
        if (qiao_dapai.length) {
            this.set_button('qiao', () => {
                this.clear_handler();
                this.select_qiao_dapai(qiao_dapai);
            });
        }

        this.show_button(() => this.select_dapai());
    };

    UIPlayer.prototype.action_fulou = function(fulou) {
        if (fulou.l != this._menfeng) return this.callback();
        if (fulou.m.match(/^[mpsz]\d{4}/)) return this.callback();

        const qiao_dapai = this.allow_qiao(this.shoupai) || [];
        if (qiao_dapai.length) {
            this.set_button('qiao', () => {
                this.clear_handler();
                this.select_qiao_dapai(qiao_dapai);
            });
        }

        this.show_button(() => this.select_dapai());
    };

    const AIPlayer = Majiang.AI;

    AIPlayer.prototype.action_zimo = function(zimo, gangzimo) {
        if (zimo.l != this._menfeng) return this._callback();

        if (zimo.buhua || Majiang.Qiaoma.is_huapai(zimo.p)) {
            return this._callback({ buhua: '-' });
        }

        let m;
        const qiao_dapai = this.allow_qiao(this.shoupai) || [];
        if      (this.select_hule(null, gangzimo)) this._callback({ hule: '-' });
        else if (this.select_pingju())             this._callback({ daopai: '-' });
        else if (qiao_dapai.length) {
            this._callback({ qiao: '-', dapai: pick_qiao_dapai(this, qiao_dapai) });
        }
        else if (m = this.select_gang())           this._callback({ gang: m });
        else this._callback({ dapai: this.select_dapai() });
    };

    AIPlayer.prototype.action_fulou = function(fulou) {
        if (fulou.l != this._menfeng)      return this._callback();
        if (fulou.m.match(/^[mpsz]\d{4}/)) return this._callback();

        const qiao_dapai = this.allow_qiao(this.shoupai) || [];
        if (qiao_dapai.length) {
            return this._callback({
                qiao: '-',
                dapai: pick_qiao_dapai(this, qiao_dapai),
            });
        }
        this._callback({ dapai: this.select_dapai() });
    };
};
