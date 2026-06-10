/* EmbedYap — Crew: edits leaderboard + Ironworker Run */
function Crew({
  embeds,
  user,
  isPhone,
  crew
}) {
  const ROSTER = crew && crew.length ? crew : window.CREW || CREW;
  const ranked = [...ROSTER].sort((a, b) => (b.updates || 0) - (a.updates || 0));
  const topPts = ranked[0] && ranked[0].updates || 1;
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const order = [1, 0, 2]; // podium center = #1

  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ey-fade",
    style: {
      maxWidth: 1080,
      margin: '0 auto',
      padding: isPhone ? '18px 14px 90px' : '28px 30px 60px'
    }
  }, /*#__PURE__*/React.createElement(Header, {
    title: "Crew",
    sub: "Edits made \xB7 rank ladder"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 12,
      alignItems: 'end',
      marginTop: 20
    }
  }, order.map(idx => {
    const c = top3[idx];
    if (!c) return /*#__PURE__*/React.createElement("div", {
      key: idx
    });
    const place = idx + 1;
    const tall = place === 1;
    const medal = ['#A6A0FF', '#C7D0DE', '#C45CCB'][idx];
    return /*#__PURE__*/React.createElement(Card, {
      key: c.id,
      pad: 16,
      glow: true,
      style: {
        textAlign: 'center',
        paddingTop: tall ? 22 : 16,
        border: '1px solid ' + (place === 1 ? 'rgba(242,201,76,.45)' : T.color.line),
        background: place === 1 ? 'linear-gradient(180deg,rgba(242,201,76,.1),#0F141C)' : steelPlate('#161D29', '#0F141C')
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        width: tall ? 64 : 52,
        height: tall ? 64 : 52,
        margin: '0 auto 10px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        background: steelPlate('#26313F', '#1A2230'),
        display: 'grid',
        placeItems: 'center',
        fontFamily: T.font.display,
        fontWeight: 800,
        fontSize: tall ? 26 : 21,
        border: '2px solid ' + medal,
        color: '#fff'
      }
    }, c.initials), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        bottom: -6,
        right: -6,
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: medal,
        color: '#1b1206',
        fontFamily: T.font.display,
        fontWeight: 800,
        fontSize: 13,
        display: 'grid',
        placeItems: 'center',
        border: '2px solid #0F141C'
      }
    }, place)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.font.display,
        fontWeight: 700,
        fontSize: tall ? 18 : 16,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, c.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: T.color.steel300
      }
    }, c.role), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.font.mono,
        fontWeight: 700,
        fontSize: tall ? 24 : 19,
        color: medal,
        marginTop: 8
      }
    }, (c.updates || 0).toLocaleString()), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.font.mono,
        fontSize: 10.5,
        color: T.color.steel400,
        letterSpacing: '.1em'
      }
    }, "EDITS \xB7 ", c.installs || 0, " INSTALLS"));
  })), /*#__PURE__*/React.createElement(Card, {
    pad: 0,
    glow: true,
    style: {
      marginTop: 14
    }
  }, rest.map((c, i) => {
    const me = user && c.id === user.id;
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '13px 18px',
        borderBottom: i < rest.length - 1 ? '1px solid ' + T.color.lineSoft : 'none',
        background: me ? 'linear-gradient(90deg,rgba(126,120,240,.14),transparent)' : 'transparent'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.display,
        fontWeight: 800,
        fontSize: 18,
        width: 28,
        color: T.color.steel400
      }
    }, i + 4), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 38,
        height: 38,
        borderRadius: 9,
        flex: '0 0 auto',
        background: steelPlate('#26313F', '#1A2230'),
        display: 'grid',
        placeItems: 'center',
        fontFamily: T.font.display,
        fontWeight: 700,
        fontSize: 15,
        border: '1px solid ' + T.color.line
      }
    }, c.initials), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: T.font.display,
        fontWeight: 600,
        fontSize: 16
      }
    }, c.name, me && /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.color.amberHot,
        fontSize: 12,
        marginLeft: 8
      }
    }, "YOU")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: T.color.steel300
      }
    }, c.role, " \xB7 ", c.updates || 0, " edits \xB7 ", c.installs || 0, " installs")), /*#__PURE__*/React.createElement("div", {
      style: {
        width: isPhone ? 70 : 160,
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, !isPhone && /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        height: 6,
        borderRadius: 4,
        background: 'rgba(0,0,0,.3)',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: (c.updates || 0) / topPts * 100 + '%',
        height: '100%',
        background: 'linear-gradient(90deg,#28355C,#7E78F0)',
        borderRadius: 4
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: T.font.mono,
        fontWeight: 700,
        fontSize: 14,
        color: '#fff',
        minWidth: 46,
        textAlign: 'right'
      }
    }, (c.updates || 0).toLocaleString())));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: T.font.display,
      fontWeight: 800,
      fontSize: 24,
      margin: 0,
      textTransform: 'uppercase',
      letterSpacing: '.02em'
    }
  }, "Ironworker Run"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.font.mono,
      fontSize: 12,
      color: T.color.steel400
    }
  }, "BREAK-TIME ARCADE")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: isPhone ? 420 : 440
    }
  }, /*#__PURE__*/React.createElement(Game, {
    user: user,
    isPhone: isPhone
  })))));
}
window.Crew = Crew;