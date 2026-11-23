(() => {
  const API = "https://imperishable-church-mpesa-backend-fa2a.onrender.com";
  const $ = (id) => document.getElementById(id);
  const addPlaceholder = (parent, title, message) => {
    const box = document.createElement("div");
    box.className = "empty-public-state";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const text = document.createElement("span");
    text.textContent = message;
    box.append(strong, text);
    parent.replaceChildren(box);
  };
  const profileImage = (url, label) => {
    const frame = document.createElement("div");
    frame.className = "profile-image-frame";
    if (url) {
      const image = document.createElement("img");
      image.src = `${API}${url}`;
      image.alt = `${label} profile photograph`;
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => {
        frame.replaceChildren();
        frame.append(makeImagePlaceholder());
      }, { once: true });
      frame.append(image);
    } else frame.append(makeImagePlaceholder());
    return frame;
  };
  const makeImagePlaceholder = () => {
    const placeholder = document.createElement("div");
    placeholder.className = "profile-image-placeholder";
    placeholder.setAttribute("aria-label", "Photograph placeholder");
    const label = document.createElement("span");
    label.textContent = "Photo withheld";
    placeholder.append(label);
    return placeholder;
  };
  const pill = (text) => {
    const el = document.createElement("span");
    el.textContent = text;
    return el;
  };
  const sponsorCard = (sponsor) => {
    const card = document.createElement("article");
    card.className = "public-profile-card";
    card.append(profileImage(sponsor.photo_url, sponsor.display_name));
    const body = document.createElement("div");
    body.className = "public-profile-body";
    const h = document.createElement("h3");
    h.textContent = sponsor.display_name;
    const bio = document.createElement("p");
    bio.textContent = sponsor.biography || "A member of our community supporting children through the programme.";
    const count = document.createElement("span");
    count.className = "profile-meta";
    const n = Number(sponsor.children_supported) || 0;
    count.textContent = `${n} ${n === 1 ? "child" : "children"} supported`;
    body.append(h, bio, count);
    card.append(body);
    return card;
  };
  const childCard = (child) => {
    const card = document.createElement("article");
    card.className = "public-profile-card";
    card.append(profileImage(child.photo_url, child.display_name));
    const body = document.createElement("div");
    body.className = "public-profile-body";
    const h = document.createElement("h3");
    h.textContent = child.display_name;
    const meta = document.createElement("span");
    meta.className = "profile-meta";
    meta.textContent = [child.age === null ? "" : `Age ${child.age}`, child.sponsorship_status === "sponsored" ? "Sponsorship active" : "Seeking support"].filter(Boolean).join(" · ");
    const background = document.createElement("p");
    background.textContent = child.background || "A child in our community with hopes, gifts, and room to grow.";
    body.append(h, meta, background);
    if (child.assigned_sponsor) {
      const sponsor = document.createElement("p");
      sponsor.className = "profile-meta";
      sponsor.textContent = `Sponsor: ${child.assigned_sponsor}`;
      body.append(sponsor);
    }
    if (child.registered_at) {
      const registration = document.createElement("small");
      registration.className = "profile-meta";
      const registered = new Date(`${String(child.registered_at).slice(0, 10)}T12:00:00`).toLocaleDateString();
      registration.textContent = `Registered ${registered}`;
      body.append(registration);
    }
    const needs = document.createElement("div");
    needs.className = "profile-needs";
    [child.educational_needs, child.welfare_needs].filter(Boolean).forEach((need) => needs.append(pill(need)));
    if (needs.childElementCount) body.append(needs);
    card.append(body);
    return card;
  };
  const relationshipCard = (relationship) => {
    const card = document.createElement("article");
    card.className = "relationship-card";
    const sponsor = document.createElement("div");
    sponsor.className = "relationship-person";
    sponsor.append(profileImage(relationship.sponsor_photo_url, relationship.sponsor_name));
    const sponsorName = document.createElement("div");
    const sn = document.createElement("strong");
    sn.textContent = relationship.sponsor_name;
    const sponsorLabel = document.createElement("small");
    sponsorLabel.textContent = "Sponsor";
    sponsorName.append(sn, sponsorLabel);
    sponsor.append(sponsorName);
    const connector = document.createElement("span");
    connector.className = "relationship-heart";
    connector.setAttribute("aria-label", "supports");
    connector.textContent = "↠";
    const child = document.createElement("div");
    child.className = "relationship-person";
    child.append(profileImage(relationship.child_photo_url, relationship.child_name));
    const childName = document.createElement("div");
    const cn = document.createElement("strong");
    cn.textContent = relationship.child_name;
    const childLabel = document.createElement("small");
    childLabel.textContent = "Supported child";
    childName.append(cn, childLabel);
    child.append(childName);
    card.append(sponsor, connector, child);
    return card;
  };
  const showFailure = () => {
    [$("sponsorDirectory"), $("childrenDirectory"), $("relationshipDirectory")].forEach((node) => {
      if (node) addPlaceholder(node, "Programme profiles are being prepared", "Please contact the church for information about the Children Sponsorship Programme.");
    });
    [$("publicSponsorCount"), $("publicChildCount"), $("publicRelationshipCount")].forEach((node) => { if (node) node.textContent = "—"; });
  };
  fetch(`${API}/api/sponsorships`, { headers: { Accept: "application/json" }, cache: "no-store" })
    .then((response) => { if (!response.ok) throw new Error("Public directory unavailable"); return response.json(); })
    .then((data) => {
      const sponsors = Array.isArray(data.sponsors) ? data.sponsors : [];
      const children = Array.isArray(data.children) ? data.children : [];
      const relationships = Array.isArray(data.relationships) ? data.relationships : [];
      $("publicSponsorCount").textContent = String(sponsors.length);
      $("publicChildCount").textContent = String(children.length);
      $("publicRelationshipCount").textContent = String(relationships.length);
      if (sponsors.length) $("sponsorDirectory").replaceChildren(...sponsors.map(sponsorCard));
      else addPlaceholder($("sponsorDirectory"), "Sponsor profiles are being prepared", "Approved profiles will appear here after sponsors have chosen to be featured. Until then, no placeholder is presented as a real sponsor.");
      if (children.length) $("childrenDirectory").replaceChildren(...children.map(childCard));
      else addPlaceholder($("childrenDirectory"), "Children’s profiles are protected", "Profiles are shared only after registration, appropriate consent, and a safeguarding review. No child details are made up for this public directory.");
      if (relationships.length) $("relationshipDirectory").replaceChildren(...relationships.map(relationshipCard));
      else addPlaceholder($("relationshipDirectory"), "Connections will be shared with care", "A sponsor-child connection appears here only when both public profiles are approved and their active sponsorship is recorded.");
    })
    .catch((error) => { console.warn("Sponsorship directory unavailable:", error); showFailure(); });
})();
