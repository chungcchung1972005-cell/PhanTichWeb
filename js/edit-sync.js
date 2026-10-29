// ALOHA Baby — AlohaEditSync: lớp gọi API yêu cầu chỉnh ảnh dùng chung trên server
// (server/edit-requests.js, mount /api/edit-requests). Thêm 2026-10-15.
//
// Dùng bởi cả 3 vai trò KHI BẬT cờ editSync: trang khách (js/chon-anh.js, chuông trong js/script.js),
// Thợ ảnh (crm/js/admin.js, đọc + ghi) và Sếp (crm/js/admin.js, chỉ đọc). Cờ TẮT (mặc định) thì các
// trang đó giữ nguyên luồng localStorage qua AlohaData (js/data-store.js). Server hiện CHỈ lưu trong
// RAM (dữ liệu giả, không MongoDB, mất khi server khởi động lại) => CHƯA có đồng bộ bền giữa các máy.
//
// Bật/tắt bằng cờ editSync trong js/features.js (mặc định false). Thiếu cờ (vd trang không nạp
// features.js, hoặc features.js bản cũ trong bộ nhớ đệm) cũng coi là TẮT. Khi tắt: mọi hàm trả
// ngay { ok: false, error: 'disabled' }, KHÔNG gọi mạng, KHÔNG đụng AlohaData / localStorage.
//
// Nguyên tắc:
//  - Không lưu gì mới vào localStorage/sessionStorage (token vẫn là token sẵn có trong phiên
//    aloha_auth, do AlohaAuth.api() tự gắn); không giữ bản sao dữ liệu ảnh.
//  - Server lỗi / mất kết nối thì báo lỗi rõ ràng, KHÔNG tự ghi local rồi báo thành công.
//  - Mọi hàm trả Promise<{ ok, status, data?, error?, code?, message?, latest? }>:
//      ok=true  -> data là JSON server trả về ({ request } hoặc { requests, at })
//      ok=false -> error là 1 trong ERRORS bên dưới, message là câu tiếng Việt hiển thị được,
//                  code là mã lỗi gốc server trả (vd 'edited_link_required'),
//                  latest là bản mới nhất khi 409 có kèm (để trang tải lại, không đè).
(function (window) {
  const BASE = '/api/edit-requests';

  const ERRORS = {
    disabled: 'Đồng bộ yêu cầu chỉnh ảnh đang tắt.',
    unavailable: 'Thiếu thành phần kết nối máy chủ (AlohaAuth).',
    offline: 'Không kết nối được máy chủ. Vui lòng thử lại sau ít phút.',
    unauthorized: 'Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập máy chủ. Vui lòng đăng nhập lại.',
    forbidden: 'Tài khoản này không có quyền thực hiện thao tác này.',
    not_found: 'Không tìm thấy yêu cầu chỉnh ảnh.',
    conflict: 'Dữ liệu vừa được người khác cập nhật. Vui lòng tải lại rồi thử lại.',
    invalid: 'Dữ liệu gửi lên chưa hợp lệ.',
    too_large: 'Dữ liệu gửi lên quá lớn.',
    rate_limited: 'Thao tác quá nhanh, vui lòng thử lại sau ít phút.',
    server_error: 'Máy chủ đang gặp lỗi, vui lòng thử lại sau.'
  };
  // Câu báo riêng cho vài mã lỗi server (server/edit-requests.js)
  const CODE_MESSAGES = {
    edited_link_required: 'Cần lưu link ảnh đã chỉnh hợp lệ trước khi Hoàn tất.',
    already_completed: 'Yêu cầu này đã Hoàn thành.',
    cannot_remove_after_complete: 'Không gỡ được link ảnh đã chỉnh sau khi đã Hoàn tất.',
    guest_not_allowed: 'Cần đăng nhập bằng tài khoản có số điện thoại để dùng chức năng này.',
    rev_required: 'Thiếu số phiên bản dữ liệu (rev).',
    bad_link: 'Link phải bắt đầu bằng https://',
    bad_text: 'Tin nhắn trống hoặc quá dài (tối đa 1500 ký tự).',
    bad_photos: 'Danh sách ảnh chưa hợp lệ.',
    source_album_required: 'Cần chọn bộ ảnh gốc do thợ gửi cho đúng buổi chụp.',
    photo_not_in_album: 'Có ảnh không thuộc bộ ảnh gốc thợ đã giao.',
    bad_source_album: 'Thông tin bộ ảnh gốc chưa hợp lệ. Kiểm tra khách, mã đơn và thư mục Drive.',
    shoot_order_required: 'Chọn khách đã chụp trong danh sách buổi chụp được giao cho bạn.',
    payment_not_verified: 'Máy chủ chưa đối soát được khoản thanh toán. Giữ nguyên ảnh và thử gửi lại.',
    payment_already_used: 'Giao dịch này đã được ghi nhận cho yêu cầu khác. Vui lòng kiểm tra tiến độ.',
    bad_extra_fee: 'Phí chỉnh ảnh đã thay đổi. Vui lòng tải lại trang để kiểm tra trước khi gửi.',
    previous_round_not_completed: 'Lượt trước chưa hoàn tất hoặc đã có lượt mới. Vui lòng tải lại tiến độ.',
    bad_parent_request: 'Không tìm thấy lượt chỉnh trước của đơn này.',
    request_in_progress: 'Yêu cầu đang được gửi từ một phiên khác. Vui lòng tải lại tiến độ.',
    store_full: 'Kho dữ liệu thử nghiệm đã đầy.'
  };

  const ID_RE = /^ER-[a-z0-9]+-[a-f0-9]{8}$/;

  function enabled() {
    return !!(window.ALOHA_FEATURES && window.ALOHA_FEATURES.editSync === true);
  }

  function fail(error, extra) {
    const code = extra && extra.code;
    return Object.assign({ ok: false, status: 0, error, message: (code && CODE_MESSAGES[code]) || ERRORS[error] }, extra || {});
  }

  // Quy đổi phản hồi của AlohaAuth.api() ({ ok, status, data }) sang kết quả thống nhất
  function toResult(res) {
    if (!res || res.status === 0) return fail('offline');
    const data = res.data && typeof res.data === 'object' ? res.data : null;
    if (res.ok) return { ok: true, status: res.status, data };
    const code = (data && data.error) || '';
    const s = res.status;
    const error = s === 401 ? 'unauthorized' : s === 403 ? 'forbidden' : s === 404 ? 'not_found'
      : s === 409 ? 'conflict' : s === 413 ? 'too_large' : s === 429 ? 'rate_limited'
      : (s === 400 || s === 422) ? 'invalid' : 'server_error';
    const extra = { status: s, code };
    // 409 có thể là xung đột rev (kèm bản mới nhất) hoặc trạng thái không cho phép (already_completed...)
    if (s === 409 && data && data.request) extra.latest = data.request;
    if (s === 409 && code && code !== 'conflict') extra.message = CODE_MESSAGES[code] || ERRORS.conflict;
    return fail(error, extra);
  }

  // Gọi API qua AlohaAuth.api() (tự gắn token của phiên hiện tại). Kiểm cờ + đăng nhập trước,
  // không gửi request vô ích.
  async function request(path, opts) {
    if (!enabled()) return fail('disabled');
    const auth = window.AlohaAuth;
    if (!auth || typeof auth.api !== 'function') return fail('unavailable');
    if (!(opts && opts.public)) {
      const s = auth.getSession && auth.getSession();
      if (!s || !s.token) return fail('unauthorized', { code: 'no_token' });
    }
    let res;
    try {
      res = await auth.api(BASE + path, { method: (opts && opts.method) || 'GET', body: opts && opts.body, auth: !(opts && opts.public) });
    } catch (e) {
      return fail('offline');
    }
    return toResult(res);
  }

  // Kiểm tham số tối thiểu phía trình duyệt (server vẫn kiểm lại toàn bộ)
  const badId = (id) => !ID_RE.test(String(id || ''));
  const badRev = (rev) => !Number.isInteger(rev);

  const api = {
    enabled,
    ERRORS: Object.freeze(Object.assign({}, ERRORS)),

    // GET /health (không cần đăng nhập): { ok, store: 'memory', count }
    health() { return request('/health', { public: true }); },

    // Khách: GET /me -> { requests, at }
    mine() { return request('/me'); },
    sourceAlbums() { return request('/albums/me'); },
    listSourceAlbums() { return request('/albums'); },
    deliverSourceAlbum(data) { return request('/albums', {method:'POST', body:data}); },

    // Thợ ảnh / Sếp: GET / (?since=<ms> chỉ lấy yêu cầu đổi sau mốc) -> { requests, at }
    list(since) {
      const q = Number.isFinite(since) ? '?since=' + encodeURIComponent(String(since)) : '';
      return request('/' + q);
    },

    // Khách (của mình) / Thợ ảnh / Sếp: GET /:id -> { request }
    get(id) {
      if (badId(id)) return Promise.resolve(fail('invalid', { code: 'bad_id' }));
      return request('/' + encodeURIComponent(id));
    },

    // Khách: POST / -> { request } (201). SĐT + tên lấy từ token ở server.
    // data: { orderCode, serviceLabel, note, photos: [{ id, src, note, isExtra }], extraFee, paymentStatus }
    create(data) {
      const d = data || {};
      const body = {
        orderCode: d.orderCode, serviceLabel: d.serviceLabel, note: d.note,
        sourceAlbumId: d.sourceAlbumId, parentRequestId: d.parentRequestId,
        photos: Array.isArray(d.photos) ? d.photos.map((p) => ({ id: p && p.id, src: p && p.src, note: (p && p.note) || '', isExtra: !!(p && p.isExtra) })) : d.photos,
        extraFee: d.extraFee, paymentStatus: d.paymentStatus, paymentCode:d.paymentCode
      };
      return request('/', { method: 'POST', body });
    },

    // Khách / Thợ ảnh: POST /:id/messages { text } -> { request }. Người gửi do server suy ra
    // từ vai trò (không gửi "from").
    addMessage(id, text) {
      if (badId(id)) return Promise.resolve(fail('invalid', { code: 'bad_id' }));
      if (typeof text !== 'string' || !text.trim()) return Promise.resolve(fail('invalid', { code: 'bad_text' }));
      return request('/' + encodeURIComponent(id) + '/messages', { method: 'POST', body: { text } });
    },

    // Khách: { done: true } (đã xem thông báo Hoàn thành) và/hoặc { editedSig } (đã xem tab Ảnh đã chỉnh).
    // Thợ ảnh: không cần tham số (tắt nhãn "Mới"). POST /:id/seen -> { request }
    markSeen(id, opts) {
      if (badId(id)) return Promise.resolve(fail('invalid', { code: 'bad_id' }));
      const o = opts || {};
      const body = {};
      if (o.done === true) body.done = true;
      if (typeof o.editedSig === 'string') body.editedSig = o.editedSig;
      return request('/' + encodeURIComponent(id) + '/seen', { method: 'POST', body });
    },

    // Thợ ảnh: POST /:id/done-photos { photoId, done } -> { request }
    setPhotoDone(id, photoId, done) {
      if (badId(id)) return Promise.resolve(fail('invalid', { code: 'bad_id' }));
      if (typeof photoId !== 'string' || typeof done !== 'boolean') return Promise.resolve(fail('invalid', { code: 'bad_photo' }));
      return request('/' + encodeURIComponent(id) + '/done-photos', { method: 'POST', body: { photoId, done } });
    },

    // Thợ ảnh: POST /:id/links { resultLink?, resultLinkOriginal?, rev } -> { request }
    // Chỉ gửi trường có trong links (không gửi = giữ nguyên; chuỗi rỗng = gỡ link). rev bắt buộc.
    setLinks(id, links, rev) {
      if (badId(id)) return Promise.resolve(fail('invalid', { code: 'bad_id' }));
      if (badRev(rev)) return Promise.resolve(fail('invalid', { code: 'rev_required' }));
      const l = links || {};
      const body = { rev };
      if (typeof l.resultLink === 'string') body.resultLink = l.resultLink.trim();
      if (typeof l.resultLinkOriginal === 'string') body.resultLinkOriginal = l.resultLinkOriginal.trim();
      if (!('resultLink' in body) && !('resultLinkOriginal' in body)) return Promise.resolve(fail('invalid', { code: 'no_links' }));
      return request('/' + encodeURIComponent(id) + '/links', { method: 'POST', body });
    },

    // Thợ ảnh: POST /:id/complete { rev } -> { request } (server bắt buộc có link ảnh đã chỉnh)
    complete(id, rev) {
      if (badId(id)) return Promise.resolve(fail('invalid', { code: 'bad_id' }));
      if (badRev(rev)) return Promise.resolve(fail('invalid', { code: 'rev_required' }));
      return request('/' + encodeURIComponent(id) + '/complete', { method: 'POST', body: { rev } });
    }
  };

  window.AlohaEditSync = Object.freeze(api);
})(window);
