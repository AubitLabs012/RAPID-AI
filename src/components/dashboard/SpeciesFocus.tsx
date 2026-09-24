import { ArrowRight, ChevronDown } from "lucide-react";
import { species } from "../../data/dashboard";
import { Button } from "../ui/button";

export function SpeciesFocus() {
  return (
    <section className="panel species-panel">
      <header><h2>Species in Focus</h2><Button className="next-button" variant="ghost" type="button">View All <ChevronDown size={15} /></Button></header>
      <div className="species-row">
        {species.map((item) => (
          <article key={item.name} className={`species-card ${item.image}`}>
            <div>
              <h3>{item.name}</h3>
              <p>{item.latin}</p>
              <span className={`risk ${item.risk}`}>{item.label}</span>
            </div>
          </article>
        ))}
        <Button className="species-next" variant="icon" type="button" aria-label="Next species"><ArrowRight size={22} /></Button>
      </div>
    </section>
  );
}
