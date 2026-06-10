/* EmbedYap — crew profile editor: emoji avatar, bio, "describe yourself" emojis */
const AVATAR_EMOJIS = ['🦺', '👷', '🔩', '⚙️', '🏗️', '🧰', '🔨', '🪝', '🧲', '⛏️', '🥽', '🧱', '📐', '🦾', '🤖', '🐐'];
const DESCRIBE_EMOJIS = ['💪', '🔥', '🐐', '🚀', '😎', '🤝', '🧠', '⚡', '🎯', '🏆', '☕', '🌮', '🛠️', '😤', '🫡', '👑', '🎸', '🍳', '🧊', '🌶️'];
function Profile({
  user,
  onClose,
  onSave
}) {
  const [name, setName] = React.useState(user.name || '');
  const [bio, setBio] = React.useState(user.bio || '');
  const [avatar, setAvatar] = React.useState(user.avatarEmoji || '');
  const [emojis, setEmojis] = React.useState(user.emojis || []);
  const toggle = e => setEmojis(arr => arr.includes(e) ? arr.filter(x => x !== e) : arr.length < 6 ? [...arr, e] : arr);
  function initialsOf(n) {
    return (n || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || user.initials;
  }
  function save() {
    const nm = name.trim() || user.name;
    onSave({
      name: nm,
      initials: initialsOf(nm),
      bio: bio.trim(),
      avatarEmoji: avatar || null,
      emojis
    });
    onClose();
  }
  return /*#__PURE__*/React.createElement("div", {
    "data-ui": true,
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(6,9,14,.6)',
      zIndex: 140,
      display: 'grid',
      placeItems: 'center',
      padding: 18
    }
  }, /*#__PURE__*/React.createElement(Card, {
    onClick: e => e.stopPropagation(),
    pad: 0,
    glow: true,
    style: {
      width: 'min(460px,100%)',
      maxHeight: '92%',
      overflowY: 'auto',
      boxShadow: T.shadow.panel
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 15,
      padding: '20px 22px',
      borderBottom: '1px solid ' + T.color.line,
      background: 'linear-gradient(180deg, rgba(30,58,107,.28), transparent)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 62,
      height: 62,
      borderRadius: 16,
      flex: '0 0 auto',
      background: user.manager ? accentPlate : steelPlate('#26313F', '#1A2230'),
      display: 'grid',
      placeItems: 'center',
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: avatar ? 32 : 24,
      color: '#fff',
      border: '1px solid ' + T.color.line
    }
  }, avatar || initialsOf(name)), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 700,
      fontSize: 22,
      lineHeight: 1.1
    }
  }, name || user.name, user.goat ? ' 🐐' : ''), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 11.5,
      color: T.color.steel400,
      marginTop: 3
    }
  }, user.role, user.manager ? ' · MANAGER' : ''), emojis.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      marginTop: 5,
      letterSpacing: '.06em'
    }
  }, emojis.join(' '))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: T.color.steel300,
      padding: 6,
      background: 'rgba(0,0,0,.25)',
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "close",
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 22,
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Kicker, null, "Name"), /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "Your name",
    style: {
      ...inputStyle,
      marginTop: 10,
      padding: '10px 12px',
      fontSize: 14.5,
      fontFamily: T.font.display,
      fontWeight: 600
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Kicker, null, "Avatar"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setAvatar(''),
    title: "Use initials",
    style: {
      width: 42,
      height: 42,
      borderRadius: 10,
      display: 'grid',
      placeItems: 'center',
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: 15,
      color: '#fff',
      background: !avatar ? accentPlate : 'rgba(146,164,196,.06)',
      border: '1px solid ' + (!avatar ? 'rgba(166,160,255,.6)' : T.color.line)
    }
  }, initialsOf(name)), AVATAR_EMOJIS.map(e => /*#__PURE__*/React.createElement("button", {
    key: e,
    onClick: () => setAvatar(e),
    style: {
      width: 42,
      height: 42,
      borderRadius: 10,
      display: 'grid',
      placeItems: 'center',
      fontSize: 22,
      background: avatar === e ? 'rgba(126,120,240,.18)' : 'rgba(146,164,196,.06)',
      border: '1px solid ' + (avatar === e ? 'rgba(166,160,255,.6)' : T.color.line)
    }
  }, e)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement(Kicker, null, "Describe yourself"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 10.5,
      color: T.color.steel400
    }
  }, emojis.length, "/6")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10
    }
  }, DESCRIBE_EMOJIS.map(e => {
    const on = emojis.includes(e);
    return /*#__PURE__*/React.createElement("button", {
      key: e,
      onClick: () => toggle(e),
      style: {
        width: 40,
        height: 40,
        borderRadius: 10,
        display: 'grid',
        placeItems: 'center',
        fontSize: 20,
        transition: 'all .12s',
        transform: on ? 'scale(1.06)' : 'none',
        background: on ? 'rgba(47,214,166,.16)' : 'rgba(146,164,196,.06)',
        border: '1px solid ' + (on ? 'rgba(47,214,166,.55)' : T.color.line)
      }
    }, e);
  }))), /*#__PURE__*/React.createElement(Field, {
    label: "Bio / status"
  }, /*#__PURE__*/React.createElement("textarea", {
    value: bio,
    onChange: e => setBio(e.target.value.slice(0, 160)),
    rows: 3,
    placeholder: "e.g. Knife plate specialist. Pours don't wait.",
    style: {
      ...inputStyle,
      resize: 'vertical',
      fontSize: 13.5,
      lineHeight: 1.5
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 10.5,
      color: T.color.steel400,
      marginTop: 5,
      textAlign: 'right'
    }
  }, bio.length, "/160"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      padding: '14px 22px',
      borderTop: '1px solid ' + T.color.line
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    onClick: onClose,
    style: {
      marginLeft: 'auto'
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    kind: "primary",
    icon: "check",
    onClick: save
  }, "Save profile"))));
}
window.Profile = Profile;