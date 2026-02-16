# Secretariat Breeding Advisor Model Card

## Purpose
Recommend top 3 stallions for a given mare with explainability and risk flags.

## Formula
- compatibility = w_traits * cosine_similarity(traits) + w_pedigree * pedigree_synergy - w_inbreeding * inbreeding_score - w_cost * normalized_fee + w_form * performance_proxy

## Features (8 traits)
Speed, Stamina, Temperament, Conformation, Health, Agility, Race IQ, Consistency (0-100 each).

## Risk flags
Injury, low sample size, high fee, inbreeding risk.

## Limitations
Demo/backtest only; not calibrated to real breeding outcomes.
